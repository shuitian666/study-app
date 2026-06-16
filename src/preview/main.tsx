import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Award,
  BookOpen,
  Bot,
  Brain,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Flame,
  Home,
  LibraryBig,
  Mail,
  Map,
  Medal,
  Package,
  PenTool,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import './styles.css';

type PageKey = 'home' | 'knowledge' | 'quiz' | 'map' | 'profile';

const navItems: { key: PageKey; label: string; desc: string; icon: typeof Home }[] = [
  { key: 'home', label: '首页', desc: '今日学习', icon: Home },
  { key: 'knowledge', label: '知识库', desc: '卡片管理', icon: LibraryBig },
  { key: 'quiz', label: '刷题', desc: '练习测验', icon: PenTool },
  { key: 'map', label: '图谱', desc: '知识关系', icon: Map },
  { key: 'profile', label: '我的', desc: '账户档案', icon: CircleUserRound },
];

const pageMeta: Record<PageKey, { title: string; subtitle: string }> = {
  home: { title: '首页', subtitle: '把今天最重要的学习任务先完成' },
  knowledge: { title: '知识库', subtitle: '按科目组织知识点，快速定位需要处理的内容' },
  quiz: { title: '刷题中心', subtitle: '围绕薄弱点安排练习，让每次答题都有反馈' },
  map: { title: '知识图谱', subtitle: '从科目到章节查看掌握结构与薄弱环节' },
  profile: { title: '我的', subtitle: '查看学习档案、成长记录与常用功能' },
};

export function App() {
  const [page, setPage] = useState<PageKey>('home');
  const meta = pageMeta[page];

  return (
    <div className="preview-canvas">
      <div className="preview-shell">
        <Sidebar page={page} onChange={setPage} />
        <main className="workspace">
          <header className="workspace-header">
            <div>
              <span className="eyebrow">LEARNING WORKSPACE</span>
              <h1>{meta.title}</h1>
              <p>{meta.subtitle}</p>
            </div>
            <div className="header-actions">
              <button className="icon-button" aria-label="邮件"><Mail size={19} /></button>
              <button className="date-chip"><CalendarDays size={16} />6 月 14 日 · 周日</button>
            </div>
          </header>
          <div className="workspace-scroll" data-page={page}>
            {page === 'home' && <HomePage />}
            {page === 'knowledge' && <KnowledgePage />}
            {page === 'quiz' && <QuizPage />}
            {page === 'map' && <MapPage />}
            {page === 'profile' && <ProfilePage />}
          </div>
        </main>
        <Overview page={page} />
      </div>
    </div>
  );
}

function Sidebar({ page, onChange }: { page: PageKey; onChange: (page: PageKey) => void }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">S</span>
        <span><strong>Smart Study</strong><small>DESKTOP</small></span>
      </div>
      <nav className="nav-list" aria-label="主导航">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = page === item.key;
          return (
            <button
              key={item.key}
              className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => onChange(item.key)}
              aria-current={active ? 'page' : undefined}
            >
              <span className="nav-icon"><Icon size={18} /></span>
              <span><strong>{item.label}</strong><small>{item.desc}</small></span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <button className="primary-block"><span><strong>开始学习</strong><small>进入卡片复习</small></span><ChevronRight size={18} /></button>
        <button className="settings-button"><Settings size={17} />设置</button>
      </div>
    </aside>
  );
}

function Overview({ page }: { page: PageKey }) {
  const context = {
    home: ['今日提醒', '20:30 前完成复习，可保持连续学习记录。'],
    knowledge: ['知识健康度', '48 个知识点已到期，药理学需要优先处理。'],
    quiz: ['练习建议', '先完成药理学专项，再回看最近 3 道错题。'],
    map: ['图谱提示', '药物代谢动力学是当前关联薄弱的核心章节。'],
    profile: ['成长提示', '再获得 340 EXP 即可升级到 Lv.18。'],
  }[page];

  return (
    <aside className="overview">
      <h2>学习概览</h2>
      <section className="overview-card level-card">
        <span>当前等级</span><strong>Lv.17</strong>
        <small>1,260 / 1,600 EXP</small>
        <Progress value={78} />
      </section>
      <section className="overview-card streak-card">
        <span>连续签到</span><strong><Flame size={20} />12 天</strong>
      </section>
      <section className="overview-card ai-card">
        <Bot size={22} />
        <h3>AI 学习助手</h3>
        <p>根据当前页面，为你准备了可执行的学习建议。</p>
        <button>查看建议 <ChevronRight size={15} /></button>
      </section>
      <section className="overview-card reminder-card">
        <h3>{context[0]}</h3><p>{context[1]}</p>
      </section>
      <p className="overview-quote">保持专注，比一次学很多更重要。</p>
    </aside>
  );
}

function HomePage() {
  return (
    <div className="page-grid home-grid">
      <section className="focus-hero">
        <div>
          <span>今日学习计划</span>
          <h2>先完成 24 张到期卡片</h2>
          <p>预计 18 分钟 · 完成后再进入专项练习</p>
          <button>继续学习 <ChevronRight size={17} /></button>
        </div>
        <div className="progress-ring"><strong>68%</strong><span>今日进度</span></div>
      </section>
      <Metric label="今日待复习" value="24" note="比昨天少 8 张" tone="indigo" />
      <Metric label="连续学习" value="12 天" note="本周已学习 5 天" tone="green" />
      <Metric label="本周经验" value="1,260" note="距离 Lv.18 还差 340" tone="amber" />
      <section className="card task-card">
        <SectionTitle title="今日任务" action="按优先级安排" />
        <Task index={1} title="到期卡片复习" meta="24 张 · 18 分钟" action="立即开始" active />
        <Task index={2} title="药理学专项练习" meta="20 题 · 预计 12 分钟" action="继续" />
        <Task index={3} title="整理薄弱知识点" meta="3 个章节" action="查看" tone="green" />
      </section>
      <section className="card mastery-card">
        <SectionTitle title="掌握度" action="72%" />
        <MasteryBar />
        <p className="legend">熟练 42% · 掌握 27% · 生疏 18% · 未学 13%</p>
      </section>
      <section className="card rhythm-card">
        <SectionTitle title="本周节奏" />
        <div className="bars">{[32, 58, 44, 72, 62, 88, 48].map((height, i) => <span key={i} className={i === 5 ? 'today' : ''} style={{ height }} />)}</div>
        <div className="days">{'一二三四五六日'.split('').map(day => <span key={day}>{day}</span>)}</div>
      </section>
    </div>
  );
}

function KnowledgePage() {
  const subjects = [['全部知识', 286], ['药理学', 82], ['药剂学', 64], ['药物化学', 53], ['药事法规', 41], ['综合能力', 46]];
  const rows = [
    ['受体激动药与拮抗药', '总论 · 更新于今天', '掌握 82%', 'green'],
    ['药物代谢动力学参数', '总论 · 4 张卡片到期', '待复习', 'amber'],
    ['胆碱受体激动药', '传出神经系统 · 12 个关联', '掌握 68%', 'blue'],
    ['抗高血压药物分类', '心血管系统 · 3 道错题', '需巩固', 'red'],
  ];
  return (
    <div className="page-grid knowledge-grid">
      <Metric label="科目" value="6" note="覆盖当前学习方向" tone="indigo" />
      <Metric label="知识点" value="286" note="已建立卡片与关联" tone="blue" />
      <Metric label="待复习" value="48" note="建议今天优先完成" tone="amber" />
      <section className="card knowledge-workspace">
        <div className="toolbar">
          <label className="search-box"><Search size={17} /><input aria-label="搜索知识点" placeholder="搜索知识点、章节或标签" /></label>
          <button>筛选 <span>3</span></button><button>最近更新</button><button className="solid">添加知识</button>
        </div>
        <div className="knowledge-columns">
          <div className="subject-list">
            <h3>科目</h3>
            {subjects.map(([name, count], i) => <button key={name} className={i === 1 ? 'selected' : ''}><span className="subject-dot" /> <strong>{name}</strong><small>{count}</small>{i === 1 && <em>待复习 16</em>}</button>)}
          </div>
          <div className="knowledge-list">
            <SectionTitle title="药理学" action="82 个知识点 · 16 个待复习" />
            {rows.map(([title, meta, status, tone], i) => (
              <button className={`knowledge-row ${i === 1 ? 'due' : ''}`} key={title}>
                <span className={`status-line ${tone}`} />
                <span><strong>{title}</strong><small>{meta}</small></span>
                <em className={`status-tag ${tone}`}>{status}</em><ChevronRight size={17} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function QuizPage() {
  const subjects = [
    ['药理学', '82 个知识点 · 420 道题', '16 个待巩固', 'indigo'],
    ['药剂学', '64 个知识点 · 280 道题', '正确率 78%', 'blue'],
    ['药物化学', '53 个知识点 · 246 道题', '正确率 71%', 'purple'],
    ['药事法规', '41 个知识点 · 192 道题', '正确率 84%', 'green'],
  ];
  return (
    <div className="page-grid quiz-grid">
      <section className="quiz-hero card">
        <div className="quiz-icon"><Brain size={30} /></div>
        <div><span>推荐练习</span><h2>药理学薄弱点专项</h2><p>20 题 · 预计 12 分钟 · 根据最近错题生成</p></div>
        <button>开始练习 <ChevronRight size={17} /></button>
      </section>
      <Metric label="累计测试" value="38" note="本周完成 6 次" tone="indigo" />
      <Metric label="平均正确率" value="76%" note="较上周提升 4%" tone="green" />
      <Metric label="错题待处理" value="13" note="3 道重复出错" tone="red" />
      <section className="card intention-card">
        <SectionTitle title="今天想怎么练？" action="已选择：查漏补缺" />
        <div className="intention-options">
          {['查漏补缺', '巩固基础', '冲刺提分', '随机练习'].map((item, i) => <button className={i === 0 ? 'active' : ''} key={item}><Target size={18} />{item}</button>)}
        </div>
      </section>
      <section className="card subject-quiz-card">
        <SectionTitle title="按科目练习" action="查看全部" />
        <div className="quiz-subjects">
          {subjects.map(([title, meta, note, tone]) => <button key={title} className={`quiz-subject ${tone}`}><span className="subject-icon"><BookOpen size={20} /></span><span><strong>{title}</strong><small>{meta}</small></span><em>{note}</em><ChevronRight size={17} /></button>)}
        </div>
      </section>
      <section className="card recent-card">
        <SectionTitle title="最近成绩" />
        {[['药理学专项', '17/20', '85%'], ['药事法规', '14/20', '70%'], ['综合能力', '18/20', '90%']].map(row => <div className="result-row" key={row[0]}><span><strong>{row[0]}</strong><small>昨天完成</small></span><b>{row[1]}</b><em>{row[2]}</em></div>)}
      </section>
    </div>
  );
}

function MapPage() {
  const chapters = [
    ['药理学总论', '24/30', 80],
    ['传出神经系统药理', '18/28', 64],
    ['心血管系统药理', '21/26', 81],
    ['抗微生物药物', '12/25', 48],
  ];
  return (
    <div className="page-grid map-grid">
      <Metric label="整体掌握率" value="72%" note="较上周提升 6%" tone="indigo" />
      <Metric label="已掌握" value="206" note="共 286 个知识点" tone="green" />
      <Metric label="薄弱关联" value="17" note="集中在 3 个章节" tone="amber" />
      <section className="card map-workspace">
        <div className="map-toolbar">
          <label className="search-box"><Search size={17} /><input aria-label="搜索图谱" placeholder="搜索科目、章节或知识点" /></label>
          <button className="active">按科目</button><button>按掌握度</button>
        </div>
        <div className="map-columns">
          <div className="chapter-tree">
            <SectionTitle title="药理学" action="82 个知识点" />
            {chapters.map(([name, amount, percent], i) => <button className={i === 1 ? 'selected' : ''} key={name}><span className="tree-toggle">{i === 1 ? '−' : '+'}</span><span><strong>{name}</strong><small>{amount} 个已掌握</small></span><em>{percent}%</em><Progress value={Number(percent)} /></button>)}
          </div>
          <div className="map-detail">
            <div className="detail-head"><span className="detail-icon"><Map size={22} /></span><div><span>当前章节</span><h3>传出神经系统药理</h3></div><strong>64%</strong></div>
            <MasteryBar />
            <h4>关键知识路径</h4>
            <div className="path-flow">
              {['递质与受体', '胆碱受体药', '肾上腺素受体药', '临床应用'].map((item, i) => <div key={item}><span>{i + 1}</span><strong>{item}</strong>{i < 3 && <ChevronRight size={18} />}</div>)}
            </div>
            <div className="weak-box"><Target size={20} /><span><strong>建议优先巩固</strong><small>胆碱受体激动药与阻断药存在 6 个薄弱关联。</small></span><button>进入学习</button></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProfilePage() {
  const actions = [
    [CalendarDays, '每日签到', '连续 12 天', 'orange'],
    [Trophy, '我的成就', '18 / 32', 'yellow'],
    [ShoppingBag, '星币商城', '2,480 星币', 'purple'],
    [Medal, '排行榜', '本周第 26 名', 'blue'],
    [Package, '背包', '24 件物品', 'green'],
    [Mail, '邮件', '2 封未读', 'red'],
  ] as const;
  return (
    <div className="page-grid profile-grid">
      <section className="profile-hero card">
        <div className="avatar">学<span className="online-dot" /></div>
        <div className="identity">
          <span>学习者档案</span><h2>天一色水</h2>
          <div className="title-badge"><Award size={16} />把书读薄了</div>
          <div className="level-line"><strong>Lv.17</strong><Progress value={78} /><small>1,260 / 1,600 EXP</small></div>
        </div>
        <button><Settings size={18} />编辑资料</button>
      </section>
      <Metric label="知识点" value="286" note="已掌握 206 个" tone="indigo" />
      <Metric label="学习天数" value="68" note="连续学习 12 天" tone="green" />
      <Metric label="累计经验" value="12,840" note="本周新增 1,260" tone="amber" />
      <section className="card profile-mastery">
        <SectionTitle title="学习掌握度" action="共 286 个知识点" />
        <MasteryBar />
        <div className="mastery-stats">{[['熟练', 120, 'green'], ['掌握', 86, 'blue'], ['生疏', 50, 'amber'], ['未学', 30, 'red']].map(item => <div key={item[0]}><span className={String(item[2])} /><small>{item[0]}</small><strong>{item[1]}</strong></div>)}</div>
        <div className="weak-note"><Target size={18} /><span><strong>当前薄弱科目</strong><small>药理学 · 药物化学</small></span><button>去巩固</button></div>
      </section>
      <section className="card action-card">
        <SectionTitle title="常用功能" action="管理全部" />
        <div className="action-grid">{actions.map(([Icon, label, value, tone]) => <button key={label}><span className={tone}><Icon size={20} /></span><span><strong>{label}</strong><small>{value}</small></span><ChevronRight size={17} /></button>)}</div>
      </section>
      <section className="card achievement-card">
        <SectionTitle title="最近成就" />
        <div className="achievement"><span><Sparkles size={22} /></span><div><strong>一周全勤</strong><small>连续 7 天完成学习计划</small></div><em>+120 EXP</em></div>
        <div className="achievement"><span><Award size={22} /></span><div><strong>稳步进阶</strong><small>掌握 200 个知识点</small></div><em>+200 EXP</em></div>
      </section>
    </div>
  );
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return <section className={`metric card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></section>;
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return <div className="section-title"><h3>{title}</h3>{action && <span>{action}</span>}</div>;
}

function Task({ index, title, meta, action, active, tone }: { index: number; title: string; meta: string; action: string; active?: boolean; tone?: string }) {
  return <button className={`task ${active ? 'active' : ''}`}><span className={`task-index ${tone ?? ''}`}>{index}</span><span><strong>{title}</strong><small>{meta}</small></span><em>{action}</em></button>;
}

function Progress({ value }: { value: number }) {
  return <span className="progress-track"><span style={{ width: `${value}%` }} /></span>;
}

function MasteryBar() {
  return <div className="mastery-bar"><span className="green" /><span className="blue" /><span className="amber" /><span className="red" /></div>;
}

createRoot(document.getElementById('desktop-preview-root')!).render(<StrictMode><App /></StrictMode>);
