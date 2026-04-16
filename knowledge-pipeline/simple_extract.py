# -*- coding: utf-8 -*-
"""
简单的mock.ts提取脚本 - 手动指定数据边界
"""

import sys
import io
import json
from pathlib import Path
from datetime import datetime

# 设置默认输出编码为UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.insert(0, str(Path(__file__).parent))

from config import PROJECT_ROOT, OUTPUT_DIR


def extract_array(content: str, start_marker: str, end_marker: str):
    """从内容中提取数组"""
    start_idx = content.find(start_marker)
    if start_idx == -1:
        return None

    # 从start_marker后开始找第一个[
    array_start = content.find('[', start_idx)
    if array_start == -1:
        return None

    # 找到匹配的]
    bracket_count = 0
    array_end = -1
    for i in range(array_start, len(content)):
        if content[i] == '[':
            bracket_count += 1
        elif content[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                array_end = i
                break

    if array_end == -1:
        return None

    return content[array_start:array_end + 1]


def ts_to_json(ts_text: str):
    """将TypeScript对象转换为JSON"""
    if not ts_text:
        return '[]'

    # 先定义替换表
    replacements = [
        # 移除类型注解
        (r':\s*Subject', ''),
        (r':\s*Chapter', ''),
        (r':\s*KnowledgePointExtended', ''),
        (r':\s*KnowledgePoint', ''),
        (r':\s*Question', ''),
        (r':\s*QuestionOption', ''),
        (r':\s*QuestionType', ''),
        (r':\s*ProficiencyLevel', ''),
        (r':\s*KnowledgeSource', ''),
        (r':\s*string', ''),
        (r':\s*number', ''),
        (r':\s*boolean', ''),
        (r':\s*any', ''),
        (r'\?:', ':'),
    ]

    result = ts_text
    for old, new in replacements:
        result = result.replace(old, new)

    # 替换变量
    now_str = datetime.now().isoformat()
    yesterday_str = datetime.fromtimestamp(datetime.now().timestamp() - 86400).isoformat()
    week_ago_str = datetime.fromtimestamp(datetime.now().timestamp() - 7 * 86400).isoformat()

    import re
    result = re.sub(r'\bnow\b', f'"{now_str}"', result)
    result = re.sub(r'\byesterday\b', f'"{yesterday_str}"', result)
    result = re.sub(r'\btwoDaysAgo\b', f'"{yesterday_str}"', result)
    result = re.sub(r'\bweekAgo\b', f'"{week_ago_str}"', result)

    # 替换 new Date(...)
    result = re.sub(r'new Date\([^)]*\)', f'"{now_str}"', result)

    # 处理单引号和键
    # 先处理特殊情况
    result = result.replace("'", '"')

    # 确保键都有引号
    result = re.sub(r'([{,])\s*(\w+):', r'\1"\2":', result)

    # 移除尾随逗号
    result = re.sub(r',\s*([}\]])', r'\1', result)

    # 移除注释
    result = re.sub(r'//.*$', '', result, flags=re.MULTILINE)
    result = re.sub(r'/\*.*?\*/', '', result, flags=re.DOTALL)

    return result


def main():
    print("=" * 60)
    print("简单提取 mock.ts 数据")
    print("=" * 60)

    mock_path = PROJECT_ROOT / 'src' / 'data' / 'mock.ts'
    if not mock_path.exists():
        print(f"\n[FAIL] 文件不存在: {mock_path}")
        return

    content = mock_path.read_text(encoding='utf-8')

    # 提取各个数组
    print("\n[1/4] 提取学科...")
    subjects_text = extract_array(
        content,
        'export const MOCK_SUBJECTS:',
        'export const MOCK_CHAPTERS:'
    )

    print("\n[2/4] 提取章节...")
    chapters_text = extract_array(
        content,
        'export const MOCK_CHAPTERS:',
        '// ==================== 预置知识点数据 ===================='
    )

    print("\n[3/4] 提取知识点...")
    kp_text = extract_array(
        content,
        'export const MOCK_KNOWLEDGE_POINTS:',
        '// ==================== 预置题目数据 ===================='
    )

    print("\n[4/4] 提取题目...")
    q_text = extract_array(
        content,
        'export const MOCK_QUESTIONS:',
        None
    )

    # 解析为JSON
    try:
        subjects = json.loads(ts_to_json(subjects_text))
        chapters = json.loads(ts_to_json(chapters_text))
        knowledge_points = json.loads(ts_to_json(kp_text))
        questions = json.loads(ts_to_json(q_text))

        print(f"\n解析成功:")
        print(f"  学科: {len(subjects)}")
        print(f"  章节: {len(chapters)}")
        print(f"  知识点: {len(knowledge_points)}")
        print(f"  题目: {len(questions)}")

    except Exception as e:
        print(f"\n[FAIL] JSON解析失败: {e}")
        print("\n尝试输出原始内容以便调试:")
        print("\n--- Subjects ---")
        print(ts_to_json(subjects_text)[:500])
        return

    # 按学科分组
    subjects_data = {}
    for subject in subjects:
        subject_id = subject['id']
        subjects_data[subject_id] = {
            'subject': subject,
            'chapters': [c for c in chapters if c.get('subjectId') == subject_id],
            'knowledgePoints': [kp for kp in knowledge_points if kp.get('subjectId') == subject_id],
            'questions': [q for q in questions if q.get('subjectId') == subject_id],
        }

        print(f"\n  {subject.get('name', subject_id)}: "
              f"{len(subjects_data[subject_id]['chapters'])} 章节, "
              f"{len(subjects_data[subject_id]['knowledgePoints'])} 知识点, "
              f"{len(subjects_data[subject_id]['questions'])} 题目")

    # 确保输出目录存在
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 生成各学科JSON
    print("\n" + "=" * 60)
    print("生成 JSON 文件")
    print("=" * 60)

    for subject_id, data in subjects_data.items():
        subject_dir = OUTPUT_DIR / subject_id
        subject_dir.mkdir(parents=True, exist_ok=True)

        output_data = {
            'version': '1.0.0',
            'subjectId': subject_id,
            'chapters': data['chapters'],
            'knowledgePoints': data['knowledgePoints'],
            'questions': data['questions'],
        }

        output_file = subject_dir / 'index.json'
        output_file.write_text(json.dumps(output_data, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f"  [OK] {output_file}")

    # 生成 metadata.json
    metadata_subjects = []
    for subject_id, data in subjects_data.items():
        subject = data['subject']
        metadata_subjects.append({
            'id': subject_id,
            'name': subject.get('name', subject_id),
            'icon': subject.get('icon', ''),
            'color': subject.get('color', ''),
            'description': f"{len(data['knowledgePoints'])}个知识点 + {len(data['questions'])}道题目",
            'kpCount': len(data['knowledgePoints']),
            'qCount': len(data['questions']),
            'chapters': data['chapters'],
        })

    metadata = {
        'version': '1.0.0',
        'lastUpdated': datetime.now().isoformat(),
        'subjects': metadata_subjects,
    }

    metadata_file = OUTPUT_DIR / 'metadata.json'
    metadata_file.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"\n  [OK] {metadata_file}")

    print("\n" + "=" * 60)
    print("[OK] 全部完成!")
    print(f"输出目录: {OUTPUT_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
