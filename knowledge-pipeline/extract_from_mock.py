# -*- coding: utf-8 -*-
"""
从 mock.ts 中提取各学科数据，生成符合OSS格式的JSON文件
"""

import sys
import io
import re
import json
from pathlib import Path
from datetime import datetime

# 设置默认输出编码为UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.insert(0, str(Path(__file__).parent))

from config import PROJECT_ROOT, OUTPUT_DIR


def parse_mock_ts(file_path: Path):
    """
    解析 mock.ts 文件，提取学科、章节、知识点、题目数据
    """
    print("=" * 60)
    print("解析 mock.ts")
    print("=" * 60)

    content = file_path.read_text(encoding='utf-8')

    # 提取 MOCK_SUBJECTS
    subjects_match = re.search(r'export const MOCK_SUBJECTS: Subject\[\] = \[(.*?)\];', content, re.DOTALL)
    subjects = []
    if subjects_match:
        subjects_text = subjects_match.group(1)
        # 简单解析，提取 id, name, icon, color
        subject_items = re.findall(r'\{[^}]*\}', subjects_text)
        for item in subject_items:
            if 'id' in item:
                subject = {}
                id_match = re.search(r"id:\s*'([^']+)'", item)
                name_match = re.search(r"name:\s*'([^']+)'", item)
                icon_match = re.search(r"icon:\s*'([^']+)'", item)
                color_match = re.search(r"color:\s*'([^']+)'", item)
                kp_count_match = re.search(r"knowledgePointCount:\s*(\d+)", item)

                if id_match:
                    subject['id'] = id_match.group(1)
                    if name_match:
                        subject['name'] = name_match.group(1)
                    if icon_match:
                        subject['icon'] = icon_match.group(1)
                    if color_match:
                        subject['color'] = color_match.group(1)
                    if kp_count_match:
                        subject['kpCount'] = int(kp_count_match.group(1))
                    subjects.append(subject)

    print(f"\n[1/5] 解析到 {len(subjects)} 个学科")
    for s in subjects:
        print(f"  - {s.get('name', s.get('id'))}")

    # 提取 MOCK_CHAPTERS
    chapters = []
    chapters_match = re.search(r'export const MOCK_CHAPTERS: Chapter\[\] = \[(.*?)\];', content, re.DOTALL)
    if chapters_match:
        chapters_text = chapters_match.group(1)
        chapter_items = re.findall(r'\{[^}]*\}', chapters_text)
        for item in chapter_items:
            if 'id' in item and 'subjectId' in item:
                chapter = {}
                id_match = re.search(r"id:\s*'([^']+)'", item)
                subject_id_match = re.search(r"subjectId:\s*'([^']+)'", item)
                name_match = re.search(r"name:\s*'([^']+)'", item)
                order_match = re.search(r"order:\s*(\d+)", item)

                if id_match and subject_id_match:
                    chapter['id'] = id_match.group(1)
                    chapter['subjectId'] = subject_id_match.group(1)
                    if name_match:
                        chapter['name'] = name_match.group(1)
                    if order_match:
                        chapter['order'] = int(order_match.group(1))
                    chapters.append(chapter)

    print(f"\n[2/5] 解析到 {len(chapters)} 个章节")

    # 提取 MOCK_KNOWLEDGE_POINTS
    knowledge_points = []
    kp_text = ""

    # 找到 MOCK_KNOWLEDGE_POINTS 的开始
    kp_start = content.find('export const MOCK_KNOWLEDGE_POINTS: KnowledgePointExtended[] = [')
    if kp_start != -1:
        # 找到匹配对应的结束括号
        bracket_count = 0
        i = kp_start
        while i < len(content):
            if content[i] == '[':
                bracket_count += 1
            elif content[i] == ']':
                bracket_count -= 1
                if bracket_count == 0:
                    break
            i += 1
        kp_text = content[kp_start:i+1:i]

    # 使用更简单的方法：找到到 MOCK_QUESTIONS 之前的内容
    kp_end = content.find('export const MOCK_QUESTIONS: Question[] = [')
    if kp_end != -1 and kp_start != -1:
        kp_section = content[kp_start:kp_end]
        # 找到第一个 [
        first_bracket = kp_section.find('[')
        # 找到最后一个 ]
        last_bracket = kp_section.rfind(']')
        if first_bracket != -1 and last_bracket != -1:
            kp_array_text = kp_section[first_bracket:last_bracket+1]

            # 转换为有效的JSON（需要处理一些清理）
            # 把 TypeScript 对象转换为 JSON
            json_text = kp_array_text
            # 移除类型注解
            json_text = re.sub(r':\s*KnowledgePointExtended', '', json_text)
            json_text = re.sub(r':\s*KnowledgePoint', '', json_text)
            json_text = re.sub(r',\s*(\w+):', r',"\1":', json_text)
            json_text = re.sub(r'(\w+):', r'"\1":', json_text)
            # 处理单引号
            json_text = json_text.replace("'", '"')
            # 处理没有引号的键（如 id: 改为 "id":
            json_text = re.sub(r'([{,])\s*(\w+):', r'\1"\2":', json_text)
            # 移除末尾的逗号
            json_text = re.sub(r',\s*([}\]])', r'\1', json_text)
            # 移除注释
            json_text = re.sub(r'//.*$', '', json_text, flags=re.MULTILINE)
            json_text = re.sub(r'/\*.*?\*/', '', json_text, flags=re.DOTALL)

            try:
                knowledge_points = json.loads(json_text)
            except Exception as e:
                print(f"  [WARN] JSON 解析失败: {e}")
                # 尝试逐个解析
                pass

    print(f"\n[3/5] 解析到 {len(knowledge_points)} 个知识点")

    # 提取 MOCK_QUESTIONS
    questions = []
    q_start = content.find('export const MOCK_QUESTIONS: Question[] = [')
    if q_start != -1:
        q_section = content[q_start:]
        first_bracket = q_section.find('[')
        last_bracket = q_section.rfind(']')
        if first_bracket != -1 and last_bracket != -1:
            q_array_text = q_section[first_bracket:last_bracket+1]

            # 转换为有效的JSON
            json_text = q_array_text
            json_text = re.sub(r':\s*Question', '', json_text)
            json_text = re.sub(r',\s*(\w+):', r',"\1":', json_text)
            json_text = re.sub(r'(\w+):', r'"\1":', json_text)
            json_text = json_text.replace("'", '"')
            json_text = re.sub(r'([{,])\s*(\w+):', r'\1"\2":', json_text)
            json_text = re.sub(r',\s*([}\]])', r'\1', json_text)
            json_text = re.sub(r'//.*$', '', json_text, flags=re.MULTILINE)
            json_text = re.sub(r'/\*.*?\*/', '', json_text, flags=re.DOTALL)

            try:
                questions = json.loads(json_text)
            except Exception as e:
                print(f"  [WARN] Question JSON 解析失败: {e}")
                pass

    print(f"\n[4/5] 解析到 {len(questions)} 道题目")

    return subjects, chapters, knowledge_points, questions


def group_by_subject(subjects, chapters, knowledge_points, questions):
    """
    按学科分组数据
    """
    print("\n[5/5] 按学科分组数据...")

    result = {}

    for subject in subjects:
        subject_id = subject['id']
        result[subject_id] = {
            'subject': subject,
            'chapters': [c for c in chapters if c.get('subjectId') == subject_id],
            'knowledgePoints': [kp for kp in knowledge_points if kp.get('subjectId') == subject_id],
            'questions': [q for q in questions if q.get('subjectId') == subject_id],
        }

        print(f"  - {subject.get('name', subject_id)}: "
              f"{len(result[subject_id]['chapters'])} 章节, "
              f"{len(result[subject_id]['knowledgePoints'])} 知识点, "
              f"{len(result[subject_id]['questions'])} 题目")

    return result


def generate_subject_json(subject_data, output_dir: Path):
    """
    生成单个学科的 index.json
    """
    subject_id = subject_data['subject']['id']
    subject_dir = output_dir / subject_id
    subject_dir.mkdir(parents=True, exist_ok=True)

    data = {
        'version': '1.0.0',
        'subjectId': subject_id,
        'chapters': subject_data['chapters'],
        'knowledgePoints': subject_data['knowledgePoints'],
        'questions': subject_data['questions'],
    }

    output_file = subject_dir / 'index.json'
    output_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')

    return output_file


def generate_metadata_json(subjects_data, output_dir: Path):
    """
    生成 metadata.json
    """
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

    output_file = output_dir / 'metadata.json'
    output_file.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')

    return output_file


def main():
    print("=" * 60)
    print("从 mock.ts 提取知识库数据")
    print("=" * 60)

    # 路径
    mock_ts_path = PROJECT_ROOT / 'src' / 'data' / 'mock.ts'
    output_dir = OUTPUT_DIR

    if not mock_ts_path.exists():
        print(f"\n[FAIL] 文件不存在: {mock_ts_path}")
        return

    # 解析
    subjects, chapters, knowledge_points, questions = parse_mock_ts(mock_ts_path)

    # 分组
    subjects_data = group_by_subject(subjects, chapters, knowledge_points, questions)

    # 确保输出目录存在
    output_dir.mkdir(parents=True, exist_ok=True)

    # 生成各学科JSON
    print("\n" + "=" * 60)
    print("生成 JSON 文件")
    print("=" * 60)

    for subject_id, data in subjects_data.items():
        output_file = generate_subject_json(data, output_dir)
        print(f"  [OK] {output_file}")

    # 生成 metadata.json
    metadata_file = generate_metadata_json(subjects_data, output_dir)
    print(f"\n  [OK] {metadata_file}")

    print("\n" + "=" * 60)
    print("[OK] 全部完成!")
    print(f"输出目录: {output_dir}")
    print("=" * 60)


if __name__ == "__main__":
    main()
