# -*- coding: utf-8 -*-
"""
将微生物与免疫学数据合并到前端 mock.ts
"""

import sys
import io
import json
from pathlib import Path

# 设置默认输出编码为UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def main():
    print("=" * 60)
    print("合并数据到 mock.ts")
    print("=" * 60)

    # 读取生成的微生物与免疫学数据
    data_file = Path(__file__).parent.parent / "output" / "微生物与免疫学" / "complete.json"
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 读取现有的 mock.ts
    mock_file = Path(__file__).parent.parent / "src" / "data" / "mock.ts"
    with open(mock_file, 'r', encoding='utf-8') as f:
        mock_content = f.read()

    # 生成知识点代码
    kp_code = "\n  // ==================== 微生物与免疫学 ====================\n"
    for kp in data['knowledgePoints']:
        kp_code += f"""  {{
    id: '{kp['id']}', subjectId: '{kp['subjectId']}', chapterId: '{kp['chapterId']}', name: '{kp['name']}',
    explanation: '{kp['explanation']}',
    proficiency: 'none', lastReviewedAt: null, nextReviewAt: now, reviewCount: 0, createdAt: weekAgo,
    source: 'import', studyRecords: [], quizRecords: [], currentScore: 0,
  }},
"""

    # 生成题目代码
    q_code = "\n  // ==================== 微生物与免疫学 ====================\n"
    for q in data['questions']:
        opt_strs = []
        for opt in q['options']:
            opt_strs.append(f"{{ id: '{opt['id']}', text: '{opt['text']}' }}")
        opts_str = ",\n            ".join(opt_strs)
        ans_str = str(q['correctAnswers']).replace('"', "'")

        q_code += f"""  {{
    id: '{q['id']}', knowledgePointId: '{q['knowledgePointId']}', subjectId: '{q['subjectId']}', type: '{q['type']}',
    stem: '{q['stem']}',
    options: [
            {opts_str}
    ],
    correctAnswers: {ans_str},
    explanation: '{q['explanation']}',
  }},
"""

    # 找到知识点数组的位置并插入
    kp_marker = "// ==================== 预置知识点数据 ===================="
    kp_end_marker = "// ==================== 预置题目数据 ===================="

    kp_start = mock_content.find(kp_marker)
    kp_end = mock_content.find(kp_end_marker)

    # 找到题目数组的位置并插入
    q_start = mock_content.find(kp_end_marker)

    # 构建新内容
    new_content = mock_content[:kp_end] + kp_code + mock_content[kp_end:q_start] + q_code + mock_content[q_start:]

    # 写入文件
    with open(mock_file, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"  添加知识点: {len(data['knowledgePoints'])} 个")
    print(f"  添加题目: {len(data['questions'])} 道")
    print(f"\n[OK] 已更新: {mock_file}")

    print("\n" + "=" * 60)
    print("完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
