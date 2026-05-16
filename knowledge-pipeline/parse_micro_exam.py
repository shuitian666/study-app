# -*- coding: utf-8 -*-
"""
微免考前复习数据解析器

解析两个文件:
1. 微免知识卡片_导入版.txt → KnowledgePoint[] (闪卡复习)
2. 微免旧题_题目选项答案解析_删争议版.txt → Question[] (配套练习)

输出:
- output/微生物与免疫学/index.json (知识点)
- output/微生物与免疫学/questions.json (题目)

用法:
    python parse_micro_exam.py
    python parse_micro_exam.py --upload   # 解析后上传到 OSS
"""

import re
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Optional

# ============================================================
# 配置
# ============================================================

DESKTOP = Path.home() / "Desktop"
CARDS_FILE = DESKTOP / "微免知识卡片_导入版.txt"
QUESTIONS_FILE = DESKTOP / "微免旧题_题目选项答案解析_删争议版.txt"

OUTPUT_DIR = Path(__file__).parent / "output" / "微生物与免疫学"
SUBJECT_ID = "micro"
SUBJECT_NAME = "微生物与免疫学"

# 标签 → 章节映射
TAG_TO_CHAPTER = {
    '微生物学': 'micro-ch1',
    '微生态': 'micro-ch1',
    '消毒灭菌': 'micro-ch1',
    '临床感染类型': 'micro-ch1',
    '真菌学': 'micro-ch1',
    '细菌学': 'micro-ch2',
    '细菌结构': 'micro-ch2',
    '细菌生长': 'micro-ch2',
    '细菌遗传': 'micro-ch2',
    '细菌代谢': 'micro-ch2',
    '细菌致病性': 'micro-ch2',
    '细菌培养': 'micro-ch2',
    '常见病原菌': 'micro-ch2',
    '常见病原体': 'micro-ch2',
    '病毒学': 'micro-ch3',
    '病毒感染': 'micro-ch3',
    '流感病毒': 'micro-ch3',
    '免疫学': 'micro-ch4',
    '免疫应答': 'micro-ch4',
    '免疫细胞': 'micro-ch4',
    '免疫器官': 'micro-ch4',
    '免疫球蛋白': 'micro-ch4',
    '免疫预防': 'micro-ch4',
}


# ============================================================
# 解析知识卡片
# ============================================================

def parse_knowledge_cards(filepath: Path) -> List[Dict]:
    """解析【知识点】→【题目】→【答案】→【解析】→【标签】→【难度】格式"""
    text = filepath.read_text(encoding='utf-8')
    blocks = text.split('\n---\n')

    cards = []
    for block in blocks:
        block = block.strip()
        if not block:
            continue

        card = {}
        # 提取各字段
        patterns = {
            'knowledge_point': r'【知识点】(.+?)(?:\n|$)',
            'question': r'【题目】(.+?)(?:\n|$)',
            'answer': r'【答案】(.+?)(?:\n|$)',
            'explanation': r'【解析】(.+?)(?:\n|$)',
            'tags': r'【标签】(.+?)(?:\n|$)',
            'difficulty': r'【难度】(.+?)(?:\n|$)',
        }

        for key, pattern in patterns.items():
            match = re.search(pattern, block)
            if match:
                card[key] = match.group(1).strip()

        if 'question' in card and 'answer' in card:
            cards.append(card)

    print(f"  [卡片] 解析出 {len(cards)} 张知识卡片")
    return cards


def cards_to_knowledge_points(cards: List[Dict], start_id: int = 100) -> List[Dict]:
    """将卡片转为 KnowledgePoint 格式"""
    knowledge_points = []

    for i, card in enumerate(cards):
        kp_id = f"kp-micro-{start_id + i:04d}"

        # 解析标签获取章节
        tags = card.get('tags', '')
        tag_parts = tags.split('/')
        topic = tag_parts[0] if tag_parts else ''
        question_type = tag_parts[1] if len(tag_parts) > 1 else ''

        chapter_id = TAG_TO_CHAPTER.get(topic, 'micro-ch1')

        # 构建 explanation: 题目 + 答案
        question = card.get('question', '')
        answer = card.get('answer', '')
        explanation_parts = [f"【题目】{question}", f"【答案】{answer}"]

        # 构建 memoryTip: 知识点名称 + 解析 + 标签 + 难度
        memory_tip_parts = []
        if card.get('knowledge_point'):
            memory_tip_parts.append(f"知识点：{card['knowledge_point']}")
        if card.get('explanation'):
            memory_tip_parts.append(f"💡 {card['explanation']}")
        if tags:
            memory_tip_parts.append(f"标签：{tags}")
        if card.get('difficulty'):
            memory_tip_parts.append(f"难度：{card['difficulty']}")

        memory_tip = ' | '.join(memory_tip_parts) if memory_tip_parts else ''

        kp = {
            "id": kp_id,
            "subjectId": SUBJECT_ID,
            "chapterId": chapter_id,
            "name": question,  # 卡片正面显示题目，做自测
            "explanation": '\n\n'.join(explanation_parts),
            "memoryTip": memory_tip,
        }
        knowledge_points.append(kp)

    return knowledge_points


# ============================================================
# 解析选择题
# ============================================================

def parse_questions(filepath: Path) -> List[Dict]:
    """解析【题目】→ options → 【答案】→ 【解析】格式的MCQ"""
    text = filepath.read_text(encoding='utf-8')
    blocks = text.split('\n---\n')

    questions = []
    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # 提取题目
        stem_match = re.search(r'【题目】(.+?)(?:\n|$)', block)
        if not stem_match:
            continue
        stem = stem_match.group(1).strip()

        # 定位关键分界点
        answer_pos = block.find('【答案】')
        if answer_pos == -1:
            continue
        explanation_pos = block.find('【解析】', answer_pos)

        # 只在题目和答案之间提取选项 (A. B. C. D. E.)，避免误解析解析中的内容
        option_section = block[:answer_pos]
        options = []
        seen_ids = set()
        option_pattern = r'^([A-E])\.\s*(.+)$'
        for line in option_section.split('\n'):
            line = line.strip()
            match = re.match(option_pattern, line)
            if match:
                opt_id = match.group(1).lower()
                # 去重：每个选项字母只取第一次出现
                if opt_id not in seen_ids:
                    seen_ids.add(opt_id)
                    options.append({
                        "id": opt_id,
                        "text": match.group(2).strip()
                    })

        # 验证：选项必须是连续的A-E，且至少4个
        if len(options) > 5 or len(options) < 2:
            # 异常：可能解析出错，跳过
            pass

        # 提取答案
        answer_match = re.search(r'【答案】([A-E])', block)
        if not answer_match:
            continue
        correct_answer = answer_match.group(1).lower()

        # 提取解析（从【解析】到末尾或下一个---）
        explanation = ''
        if explanation_pos != -1:
            explanation = block[explanation_pos + 5:].strip()  # skip 【解析】\n
            # 清理解析中可能残留的 ---
            explanation = re.sub(r'\n---\s*$', '', explanation)
            # 清理空行开头
            explanation = explanation.strip()

        questions.append({
            "stem": stem,
            "options": options,
            "correctAnswers": [correct_answer],
            "explanation": explanation,
        })

    print(f"  [题目] 解析出 {len(questions)} 道选择题")
    return questions


def questions_to_app_format(questions: List[Dict], start_id: int = 200) -> List[Dict]:
    """转为应用 Question 格式"""
    app_questions = []

    for i, q in enumerate(questions):
        q_id = f"q-micro-{start_id + i:04d}"

        app_q = {
            "id": q_id,
            "knowledgePointId": q.get("knowledgePointId"),
            "subjectId": SUBJECT_ID,
            "type": "single_choice",
            "stem": q["stem"],
            "options": q["options"],
            "correctAnswers": q["correctAnswers"],
            "explanation": q.get("explanation", ""),
        }
        app_questions.append(app_q)

    return app_questions


# ============================================================
# 关联题目到知识点
# ============================================================

def link_questions_to_kps(questions: List[Dict], knowledge_points: List[Dict]) -> List[Dict]:
    """
    通过知识点名称精确匹配将MCQ关联到知识点

    策略：
    1. 提取每个KP的完整知识点名称（3字以上）
    2. 在题目stem+选项+解析中搜索完整知识点名称
    3. 也搜索KP答案中的关键专业术语
    4. 命中完整术语才关联，避免常见字误匹配
    """

    def extract_significant_terms(kp: Dict) -> List[str]:
        """提取KP中的显著术语（用于匹配）"""
        terms = []
        memory_tip = kp.get('memoryTip', '')

        # 1. 知识点完整名称（最重要的匹配项）
        kp_name_match = re.search(r'知识点：(.+?)(?:\s*\|)', memory_tip)
        if kp_name_match:
            name = kp_name_match.group(1).strip()
            if len(name) >= 3:
                terms.append(('kp_name', name, 10))  # 完整知识点名权重最高

        # 2. 从KP答案中提取专业术语（排除常见词）
        explanation = kp.get('explanation', '')
        # 提取中文专有名词（引号内、括号内、特定格式）
        quoted = re.findall(r'[「「](.+?)[」」]', explanation)
        for t in quoted:
            if len(t) >= 3:
                terms.append(('quoted', t, 6))

        # 3. 英文缩写（高特异性）
        english_abbr = re.findall(r'\b([A-Z]{2,}(?:[-\u00b7][A-Z]+)?)\b', explanation + ' ' + kp.get('name', ''))
        for t in english_abbr:
            if len(t) >= 2:
                terms.append(('abbr', t, 8))

        # 4. 从name（题目）中提取关键概念
        q_name = kp.get('name', '')
        # 提取 "什么是XXX" 中的 XXX
        what_is = re.findall(r'什么是(.+?)[？?]', q_name)
        for t in what_is:
            if len(t) >= 3:
                terms.append(('concept', t, 7))

        # 5. 提取 "XXX的定义/特点/分类" 等核心名词短语
        core_nouns = re.findall(r'([\u4e00-\u9fff]{3,8}(?:的定义|的特点|的分类|的作用|的功能|的机制))', q_name)
        for t in core_nouns:
            terms.append(('core', t, 5))

        return terms

    # 为每个KP提取显著术语
    kp_terms_list = [extract_significant_terms(kp) for kp in knowledge_points]

    # 统计术语在KP中的出现频率（IDF思想：常见术语降低权重）
    from collections import Counter
    term_freq = Counter()
    for terms in kp_terms_list:
        for _, term, _ in terms:
            term_freq[term] += 1
    num_kps = len(knowledge_points)
    # IDF权重：出现在少数KP中的术语权重高
    def get_idf_weight(term: str) -> float:
        return 1.0 / max(term_freq.get(term, 1), 1)

    linked_count = 0
    for q in questions:
        q_text = q['stem'] + ' ' + q.get('explanation', '')
        for opt in q.get('options', []):
            q_text += ' ' + opt['text']
        # 标准化：移除空白
        q_text_compact = re.sub(r'\s+', '', q_text)

        best_kp_idx = -1
        best_score = 0.0

        for idx, terms in enumerate(kp_terms_list):
            if not terms:
                continue

            score = 0.0
            has_solid_match = False
            matched_terms = []

            for term_type, term, base_weight in terms:
                term_compact = re.sub(r'\s+', '', term)
                if term_compact in q_text_compact:
                    idf_w = get_idf_weight(term)
                    term_score = base_weight * idf_w * len(term)
                    score += term_score
                    matched_terms.append(term)
                    # 完整知识点名或4字以上术语算solid match
                    if term_type in ('kp_name', 'abbr') or len(term) >= 4:
                        has_solid_match = True

            # 必须至少有一个solid match
            if has_solid_match and score > best_score:
                best_score = score
                best_kp_idx = idx

        # 阈值：至少8分（命中一个中等特异性术语 + 部分重叠）
        if best_score >= 8 and best_kp_idx >= 0:
            q['knowledgePointId'] = knowledge_points[best_kp_idx]['id']
            linked_count += 1

    print(f"  [关联] {linked_count}/{len(questions)} 道题成功关联到知识点")
    return questions


# ============================================================
# 打印统计
# ============================================================

def print_stats(knowledge_points: List[Dict], questions: List[Dict]):
    """打印章节分布和标签统计"""
    chapter_names = {
        'micro-ch1': '微生物学基础',
        'micro-ch2': '细菌学',
        'micro-ch3': '病毒学',
        'micro-ch4': '免疫学基础',
    }

    print("\n" + "=" * 50)
    print("知识点章节分布:")
    ch_count = {}
    for kp in knowledge_points:
        ch = kp.get('chapterId', 'unknown')
        ch_count[ch] = ch_count.get(ch, 0) + 1
    for ch, count in sorted(ch_count.items()):
        name = chapter_names.get(ch, ch)
        print(f"  {name} ({ch}): {count} 张")

    print(f"\n总计: {len(knowledge_points)} 张知识卡片, {len(questions)} 道选择题")

    # 关联统计
    linked = sum(1 for q in questions if q.get('knowledgePointId'))
    unlinked = len(questions) - linked
    print(f"关联: {linked} 道, 未关联: {unlinked} 道")


# ============================================================
# 保存与上传
# ============================================================

def save_output(knowledge_points: List[Dict], questions: List[Dict]):
    """保存到 output 目录"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 保存知识点
    index_file = OUTPUT_DIR / "index.json"
    kp_data = {
        "version": "2.0",
        "exportTime": datetime.now().isoformat(),
        "subjectId": SUBJECT_ID,
        "subjectName": SUBJECT_NAME,
        "total": len(knowledge_points),
        "knowledgePoints": knowledge_points,
    }
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(kp_data, f, ensure_ascii=False, indent=2)
    print(f"\n  [保存] {index_file} ({len(knowledge_points)} KPs)")

    # 保存题目
    q_file = OUTPUT_DIR / "questions.json"
    q_data = {
        "version": "2.0",
        "exportTime": datetime.now().isoformat(),
        "subjectId": SUBJECT_ID,
        "subjectName": SUBJECT_NAME,
        "total": len(questions),
        "questions": questions,
    }
    with open(q_file, 'w', encoding='utf-8') as f:
        json.dump(q_data, f, ensure_ascii=False, indent=2)
    print(f"  [保存] {q_file} ({len(questions)} questions)")

    return str(OUTPUT_DIR)


def upload_to_oss():
    """上传到 OSS"""
    try:
        sys.path.insert(0, str(Path(__file__).parent))
        from storage.oss_uploader import OSSUploader
        from config import OSS_CONFIG

        uploader = OSSUploader(OSS_CONFIG)
        if not uploader.enabled:
            print("\n  [OSS] 未配置，跳过上传")
            return False

        print("\n  [OSS] 开始上传...")
        uploader.upload_directory(str(OUTPUT_DIR), f"knowledge/{SUBJECT_ID}")
        return True
    except Exception as e:
        print(f"\n  [OSS] 上传失败: {e}")
        return False


# ============================================================
# 主入口
# ============================================================

def main():
    do_upload = '--upload' in sys.argv or '-u' in sys.argv

    print("=" * 60)
    print("微免考前复习数据解析器")
    print("=" * 60)

    # 1. 解析知识卡片
    print("\n[1/4] 解析知识卡片...")
    if not CARDS_FILE.exists():
        print(f"  [ERROR] 找不到文件: {CARDS_FILE}")
        sys.exit(1)
    cards = parse_knowledge_cards(CARDS_FILE)
    knowledge_points = cards_to_knowledge_points(cards)

    # 2. 解析选择题
    print("\n[2/4] 解析选择题...")
    if not QUESTIONS_FILE.exists():
        print(f"  [ERROR] 找不到文件: {QUESTIONS_FILE}")
        sys.exit(1)
    raw_questions = parse_questions(QUESTIONS_FILE)

    # 3. 关联题目到知识点
    print("\n[3/4] 关联题目到知识点...")
    raw_questions = link_questions_to_kps(raw_questions, knowledge_points)
    questions = questions_to_app_format(raw_questions)

    # 4. 保存并上传
    print("\n[4/4] 保存数据...")
    save_output(knowledge_points, questions)

    # 打印统计
    print_stats(knowledge_points, questions)

    # 上传
    if do_upload:
        upload_to_oss()
    else:
        print("\n  [提示] 使用 --upload 参数上传到 OSS")

    print("\n" + "=" * 60)
    print("解析完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
