# -*- coding: utf-8 -*-
"""
测试题目解析器 - 解析微生物题目.txt
"""

import sys
import io
from pathlib import Path

# 设置默认输出编码为UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.insert(0, str(Path(__file__).parent))

from processors import QuestionParser
from storage import LocalStorage
from config import OUTPUT_DIR


def main():
    print("=" * 60)
    print("题目解析测试")
    print("=" * 60)

    # 文件路径
    file_path = r"C:\Users\35460\Desktop\微生物题目.txt"
    subject_name = "免疫学题目"
    subject_id = "immuno"

    print(f"\n[1/4] 读取文件: {file_path}")

    # 解析题目
    print("\n[2/4] 解析题目...")
    parser = QuestionParser()
    try:
        questions, knowledge_points = parser.parse_file(
            file_path,
            subject_id=subject_id,
            chapter_id="immunology-ch1"
        )
    except Exception as e:
        print(f"  [FAIL] 解析失败: {e}")
        import traceback
        traceback.print_exc()
        return

    print(f"  [OK] 解析完成:")
    print(f"    - 题目: {len(questions)} 道")
    print(f"    - 知识点: {len(knowledge_points)} 个")

    # 显示预览
    print("\n[3/4] 题目预览:")
    for i, q in enumerate(questions[:3], 1):
        print(f"\n--- 第{i}题 ---")
        print(f"题干: {q['stem']}")
        print(f"选项:")
        for opt in q['options']:
            marker = "[正确]" if opt['id'] in q['correctAnswers'] else "      "
            print(f"  {marker} {opt['id'].upper()}. {opt['text']}")
        print(f"解析: {q['explanation'][:80]}...")

    if knowledge_points:
        print(f"\n知识点预览:")
        for i, kp in enumerate(knowledge_points[:3], 1):
            print(f"\n{i}. {kp['name']}")
            print(f"   {kp['explanation'][:80]}...")

    # 保存（不询问，直接保存）
    print("\n" + "=" * 60)
    print("\n[4/4] 保存到本地...")
    try:
        storage = LocalStorage(OUTPUT_DIR)
        storage.save_knowledge(subject_id, subject_name, knowledge_points, questions)
        print(f"  [OK] 已保存!")
        print(f"  目录: {OUTPUT_DIR / subject_name}")

        # 显示统计
        stats = storage.get_stats()
        print(f"\n本地知识库统计:")
        print(f"  学科数: {stats['totalSubjects']}")
        print(f"  知识点: {stats['totalKnowledgePoints']}")
        print(f"  题    目: {stats['totalQuestions']}")

    except Exception as e:
        print(f"  [FAIL] 保存失败: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 60)
    print("完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
