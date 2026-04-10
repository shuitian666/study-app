# -*- coding: utf-8 -*-
"""
生成完整的免疫学数据（包含Subject和Chapter）
"""

import sys
import io
import json
from pathlib import Path
from datetime import datetime

# 设置默认输出编码为UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.insert(0, str(Path(__file__).parent))

from processors import QuestionParser


def main():
    print("=" * 60)
    print("生成完整的免疫学数据")
    print("=" * 60)

    # 文件路径
    file_path = r"C:\Users\35460\Desktop\微生物题目.txt"
    subject_id = "immuno"
    chapter_id = "immunology-ch1"

    print(f"\n[1/4] 读取并解析题目...")

    parser = QuestionParser()
    try:
        questions, knowledge_points = parser.parse_file(
            file_path,
            subject_id=subject_id,
            chapter_id=chapter_id
        )
    except Exception as e:
        print(f"  [FAIL] 解析失败: {e}")
        import traceback
        traceback.print_exc()
        return

    print(f"  [OK] 解析完成:")
    print(f"    - 题目: {len(questions)} 道")
    print(f"    - 知识点: {len(knowledge_points)} 个")

    print(f"\n[2/4] 验证关联关系...")
    # 验证题目都有关联的知识点
    kp_ids = set(kp['id'] for kp in knowledge_points)
    matched_count = 0
    for q in questions:
        if q['knowledgePointId'] in kp_ids:
            matched_count += 1

    print(f"  题目-知识点关联: {matched_count}/{len(questions)}")

    print(f"\n[3/4] 构建完整数据结构...")

    now = datetime.now().isoformat()

    # 定义学科
    subject = {
        "id": "immuno",
        "name": "免疫学",
        "icon": "🔬",
        "color": "#8b5cf6",
        "knowledgePointCount": len(knowledge_points)
    }

    # 定义章节
    chapter = {
        "id": "immunology-ch1",
        "subjectId": "immuno",
        "name": "免疫学基础",
        "order": 1
    }

    # 完整数据
    complete_data = {
        "version": "1.0",
        "lastUpdated": now,
        "subjects": [subject],
        "chapters": [chapter],
        "knowledgePoints": knowledge_points,
        "questions": questions,
        "total": len(knowledge_points)
    }

    print(f"\n[4/4] 保存文件...")

    output_file = Path(__file__).parent.parent / "output" / "免疫学题目" / "complete.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(complete_data, f, ensure_ascii=False, indent=2)

    print(f"  [OK] 已保存到: {output_file}")

    # 同时生成OSS格式（只包含knowledgePoints和questions）
    oss_data = {
        "version": "1.0",
        "lastUpdated": now,
        "knowledgePoints": knowledge_points,
        "questions": questions,
        "total": len(knowledge_points)
    }

    oss_file = Path(__file__).parent.parent / "output" / "免疫学题目" / "oss_ready.json"
    with open(oss_file, 'w', encoding='utf-8') as f:
        json.dump(oss_data, f, ensure_ascii=False, indent=2)

    print(f"  [OK] OSS格式已保存到: {oss_file}")

    print("\n" + "=" * 60)
    print("完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
