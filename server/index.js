import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { chatCompletion, extractContent, listAvailableProviders } from './providers.js';
import { 
  CHAT_SYSTEM_PROMPT, 
  QUIZ_SYSTEM_PROMPT,
  SMART_QUIZ_SYSTEM_PROMPT,
  ENCOURAGE_SYSTEM_PROMPT,
  STUDY_REPORT_PROMPT,
  DAILY_SUGGESTION_PROMPT,
  OPENCLAW_KB_SYSTEM,
  buildChatMessages 
} from './prompts.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ===== GET /api/models =====
app.get('/api/models', async (_req, res) => {
  try {
    const providers = await listAvailableProviders();
    res.json({ providers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== POST /api/chat (SSE 流式) =====
app.post('/api/chat', async (req, res) => {
  const { provider = 'ollama', messages = [], knowledgeContext, apiKey, modelId, groupId } = req.body;

  // 如果 provider 是 openclaw，使用知识库关联系统提示
  const systemPrompt = provider === 'openclaw' ? OPENCLAW_KB_SYSTEM : CHAT_SYSTEM_PROMPT;
  const fullMessages = buildChatMessages(systemPrompt, knowledgeContext, messages);
  
  // 用户配置（支持前端动态传入）
  const userConfig = { apiKey, modelId, groupId };

  // 设置 SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲

  try {
    const response = await chatCompletion(provider, fullMessages, { stream: true, userConfig });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') {
          res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
          continue;
        }
        try {
          const chunk = JSON.parse(payload);
          const content = chunk.choices?.[0]?.delta?.content || '';
          if (content) {
            res.write(`data: ${JSON.stringify({ content, done: false })}\n\n`);
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    // 确保发送完成信号
    res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Chat error:', err.message);
    // 如果 headers 已发送，通过 SSE 发送错误
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }

  // 防止连接悬挂
  req.on('close', () => {
    res.end();
  });
});

// ===== POST /api/quiz (JSON) =====
app.post('/api/quiz', async (req, res) => {
  const { 
    provider = 'ollama', 
    knowledgePointNames = [], 
    knowledgePoints = [], // 智能模式：[{id, name, masteryLevel, wrongCount, lastReviewedAt}]
    subjectName = '', 
    apiKey, 
    modelId, 
    groupId,
    mode = 'random' // random | smart (智能私教模式)
  } = req.body;

  // 智能私教模式：基于掌握程度自动选题
  if (mode === 'smart' && knowledgePoints.length > 0) {
    const userContent = `# 学生知识点掌握情况

以下是学生当前${subjectName ? `【${subjectName}】` : ''}的知识点掌握情况：
${knowledgePoints.map(kp => `- ${kp.name}：掌握等级 ${kp.masteryLevel}/3（未掌握=1，掌握中=2，已掌握=3），错题数：${kp.wrongCount || 0}，上次复习：${kp.lastReviewedAt || '从未'}`).join('\n')}

请你作为私教，根据遗忘曲线和掌握程度，选择一道当前最需要练习的知识点出题。`;

    const messages = [
      { role: 'system', content: SMART_QUIZ_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ];
    
    const userConfig = { apiKey, modelId, groupId };

    try {
      const response = await chatCompletion(provider, messages, { stream: false, temperature: 0.8, userConfig });
      const text = await extractContent(response);

      // 尝试解析 JSON（去掉可能的 markdown 代码块标记）
      const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
      const result = JSON.parse(cleaned);

      // 校验必要字段
      if (!result.question || !result.question.stem || !result.question.options || !result.question.correctAnswers) {
        return res.json({ question: null, error: 'incomplete_fields' });
      }

      res.json({ 
        question: result.question,
        selectedKnowledgePoint: result.selectedKnowledgePoint,
        mode: 'smart'
      });
    } catch (err) {
      console.error('Smart Quiz error:', err.message);
      res.json({ question: null, error: err.message });
    }
  } else {
    // 传统随机模式：指定知识点出题
    const userContent = `请根据以下知识点出一道选择题：\n知识点：${knowledgePointNames.join('、')}\n学科：${subjectName}`;
    const messages = [
      { role: 'system', content: QUIZ_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ];
    
    const userConfig = { apiKey, modelId, groupId };

    try {
      const response = await chatCompletion(provider, messages, { stream: false, temperature: 0.8, userConfig });
      const text = await extractContent(response);

      // 尝试解析 JSON（去掉可能的 markdown 代码块标记）
      const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
      const question = JSON.parse(cleaned);

      // 校验必要字段
      if (!question.stem || !question.options || !question.correctAnswers) {
        return res.json({ question: null, error: 'incomplete_fields' });
      }

      res.json({ question, mode: 'random' });
    } catch (err) {
      console.error('Quiz error:', err.message);
      res.json({ question: null, error: err.message });
    }
  }
});

// ===== POST /api/encourage (JSON) =====
app.post('/api/encourage', async (req, res) => {
  const { provider = 'ollama', stats = {}, wrongCount = 0, streak = 0, apiKey, modelId, groupId } = req.body;

  const userContent = `学生统计：总知识点${stats.totalKnowledgePoints || 0}个，已掌握${stats.masteredCount || 0}个，错题${wrongCount}道，连续学习${streak}天，弱科：${(stats.weakSubjects || []).join('、') || '无'}`;
  const messages = [
    { role: 'system', content: ENCOURAGE_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
  
  const userConfig = { apiKey, modelId, groupId };

  try {
    const response = await chatCompletion(provider, messages, {
      stream: false,
      temperature: 0.9,
      maxTokens: 100,
      userConfig,
    });
    const text = await extractContent(response);
    res.json({ text: text || '今天也要加油哦！' });
  } catch (err) {
    console.error('Encourage error:', err.message);
    res.json({ text: '今天也要加油哦！', error: err.message });
  }
});

// ===== 组队 API =====
// 内存存储队伍数据（生产环境应使用数据库）
const teams = new Map();

// 生成6位邀请码
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /api/team/create - 创建队伍
app.post('/api/team/create', (req, res) => {
  const { userId, userName, userAvatar } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const teamId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inviteCode = generateInviteCode();
  
  const team = {
    id: teamId,
    inviteCode,
    members: [{
      id: userId,
      name: userName || '用户',
      avatar: userAvatar || '👤',
      isSimulated: false,
      progress: { taskCompletionRate: 0, studyMinutes: 0, isReady: false, lastUpdated: new Date().toISOString() },
    }],
    status: 'waiting',
    createdAt: new Date().toISOString(),
    todayCheckedIn: false,
  };
  
  teams.set(teamId, team);
  res.json({ teamId, inviteCode, team });
});

// POST /api/team/join - 加入队伍
app.post('/api/team/join', (req, res) => {
  const { inviteCode, userId, userName, userAvatar } = req.body;
  
  if (!inviteCode || !userId) {
    return res.status(400).json({ error: 'inviteCode and userId are required' });
  }
  
  // 查找队伍
  let targetTeam = null;
  for (const [id, team] of teams) {
    if (team.inviteCode === inviteCode.toUpperCase() && team.status === 'waiting') {
      targetTeam = { ...team, id };
      break;
    }
  }
  
  if (!targetTeam) {
    return res.status(404).json({ error: 'Team not found or not joinable' });
  }
  
  // 添加成员
  const newMember = {
    id: userId,
    name: userName || '用户',
    avatar: userAvatar || '👤',
    isSimulated: false,
    progress: { taskCompletionRate: 0, studyMinutes: 0, isReady: false, lastUpdated: new Date().toISOString() },
  };
  
  targetTeam.members.push(newMember);
  targetTeam.status = 'active';
  teams.set(targetTeam.id, targetTeam);
  
  res.json({
    teamId: targetTeam.id,
    inviteCode: targetTeam.inviteCode,
    members: targetTeam.members,
    status: targetTeam.status,
    createdAt: targetTeam.createdAt,
  });
});

// GET /api/team/:teamId - 获取队伍状态
app.get('/api/team/:teamId', (req, res) => {
  const team = teams.get(req.params.teamId);
  
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  res.json(team);
});

// GET /api/team/code/:inviteCode - 通过邀请码获取队伍状态
app.get('/api/team/code/:inviteCode', (req, res) => {
  const code = req.params.inviteCode.toUpperCase();
  
  for (const [id, team] of teams) {
    if (team.inviteCode === code) {
      return res.json(team);
    }
  }
  
  res.status(404).json({ error: 'Team not found' });
});

// POST /api/team/progress - 更新成员进度
app.post('/api/team/progress', (req, res) => {
  const { teamId, userId, progress } = req.body;
  
  if (!teamId || !userId || !progress) {
    return res.status(400).json({ error: 'teamId, userId, and progress are required' });
  }
  
  const team = teams.get(teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  const member = team.members.find(m => m.id === userId);
  if (member) {
    member.progress = {
      ...progress,
      lastUpdated: new Date().toISOString(),
    };
    teams.set(teamId, team);
  }
  
  res.json({ success: true });
});

// POST /api/team/dissolve - 解散队伍
app.post('/api/team/dissolve', (req, res) => {
  const { teamId } = req.body;
  
  if (!teamId) {
    return res.status(400).json({ error: 'teamId is required' });
  }
  
  teams.delete(teamId);
  res.json({ success: true });
});

// ===== POST /api/explain - AI生成题目解析 =====
app.post('/api/explain', async (req, res) => {
  const { 
    provider = 'ollama', 
    question, 
    selectedAnswer, 
    correctAnswer,
    knowledgePoint,
    subjectName,
    apiKey, 
    modelId, 
    groupId 
  } = req.body;

  const userContent = `请为以下题目生成详细的解析：

学科：${subjectName || '未知'}
知识点：${knowledgePoint || '未知'}

题目：${question.stem || question}
选项：${question.options ? question.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o.text}`).join('\n') : ''}
用户答案：${selectedAnswer}
正确答案：${correctAnswer}

请生成包含以下内容的详细解析：
1. ✅ 正确答案分析
2. ❌ 错误选项逐个解析
3. 📚 **相关知识点讲解**（这里需要关联基础知识，帮学生复习）
4. 💡 记忆技巧（如果适用）
5. 🔗 关联知识扩展（相关的相似知识点、前置知识）

请用清晰、有条理的方式回答，就像私教一对一辅导。利用知识库中的内容帮助学生融会贯通。`;

  const messages = [
    { role: 'system', content: '你是一位专业的私教学习导师，擅长解释知识点和题目。你会主动关联相关知识库内容，帮助学生建立知识网络。请用简洁明了的语言解释问题。' },
    { role: 'user', content: userContent },
  ];

  const userConfig = { apiKey, modelId, groupId };

  try {
    const response = await chatCompletion(provider, messages, { stream: false, temperature: 0.7, userConfig });
    const text = await extractContent(response);
    res.json({ explanation: text });
  } catch (err) {
    console.error('Explain error:', err.message);
    res.json({ explanation: '抱歉，无法生成解析。请稍后重试。', error: err.message });
  }
});

// 健康检查端点
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== POST /api/study-report - 生成学习报告 =====
app.post('/api/study-report', async (req, res) => {
  const { 
    provider = 'ollama', 
    knowledgeStats = [], 
    totalKnowledgePoints = 0,
    masteredCount = 0,
    subjectName = '',
    apiKey, 
    modelId, 
    groupId 
  } = req.body;

  const userContent = `# 学生学习数据

学科：${subjectName || '全部'}
总知识点：${totalKnowledgePoints}
已掌握：${masteredCount}

知识点详情：
${knowledgeStats.map(kp => `- ${kp.name}: 掌握等级 ${kp.masteryLevel}/3，错题数 ${kp.wrongCount || 0}`).join('\n')}

请生成学习报告。`;

  const messages = [
    { role: 'system', content: STUDY_REPORT_PROMPT },
    { role: 'user', content: userContent },
  ];
  
  const userConfig = { apiKey, modelId, groupId };

  try {
    const response = await chatCompletion(provider, messages, { stream: false, temperature: 0.7, userConfig });
    const text = await extractContent(response);
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
    const report = JSON.parse(cleaned);
    res.json({ report });
  } catch (err) {
    console.error('Study report error:', err.message);
    res.json({ report: null, error: err.message });
  }
});

// ===== POST /api/daily-suggestion - 获取每日学习建议 =====
app.post('/api/daily-suggestion', async (req, res) => {
  const { 
    provider = 'ollama', 
    knowledgeStats = [], 
    totalKnowledgePoints = 0,
    masteredCount = 0,
    subjectName = '',
    apiKey, 
    modelId, 
    groupId 
  } = req.body;

  const userContent = `# 学生学习数据

学科：${subjectName || '全部'}
总知识点：${totalKnowledgePoints}
已掌握：${masteredCount}

知识点掌握情况：
${knowledgeStats.map(kp => `- ${kp.name}: 掌握等级 ${kp.masteryLevel}/3，错题数 ${kp.wrongCount || 0}，上次复习 ${kp.lastReviewedAt || '从未'}`).join('\n')}

请给出今天的学习建议。`;

  const messages = [
    { role: 'system', content: DAILY_SUGGESTION_PROMPT },
    { role: 'user', content: userContent },
  ];
  
  const userConfig = { apiKey, modelId, groupId };

  try {
    const response = await chatCompletion(provider, messages, { stream: false, temperature: 0.7, userConfig });
    const text = await extractContent(response);
    const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
    const result = JSON.parse(cleaned);
    res.json(result);
  } catch (err) {
    console.error('Daily suggestion error:', err.message);
    res.json({ suggestions: null, error: err.message });
  }
});

// ===== POST /api/knowledge-explain - 知识库关联讲解 =====
app.post('/api/knowledge-explain', async (req, res) => {
  const { 
    provider = 'ollama', 
    knowledgePoint,
    subjectName,
    relatedTo = [],
    apiKey, 
    modelId, 
    groupId 
  } = req.body;

  const userContent = `请给我讲解知识点"${knowledgePoint}"（学科：${subjectName}）。

${relatedTo.length > 0 ? `需要关联讲解这些前置知识点：${relatedTo.join('、')}` : ''}

请结合OpenClaw知识库中的内容，进行清晰有条理的讲解，主动关联相关知识帮助理解。`;

  const messages = [
    { role: 'system', content: OPENCLAW_KB_SYSTEM },
    { role: 'user', content: userContent },
  ];
  
  const userConfig = { apiKey, modelId, groupId };

  try {
    const response = await chatCompletion(provider, messages, { stream: false, temperature: 0.6, userConfig });
    const explanation = await extractContent(response);
    res.json({ explanation });
  } catch (err) {
    console.error('Knowledge explain error:', err.message);
    res.json({ explanation: null, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI proxy server running on http://localhost:${PORT}`);
  console.log('✅ OpenClaw 智能私教已接入！支持：');
  console.log('  - /api/quiz 智能出题（随机/智能模式）');
  console.log('  - /api/explain 关联式题目解析');
  console.log('  - /api/study-report 学习报告');
  console.log('  - /api/daily-suggestion 每日学习建议');
  console.log('  - /api/knowledge-explain 知识点关联讲解');
  console.log('支持云端 API Key 动态配置！');
});
