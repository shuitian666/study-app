# -*- coding: utf-8 -*-
"""测试解析脚本"""
import re
import sys

# 测试文本
test_text = """
1.溶剂和溶质都符合拉乌尔定律的溶液是 （）

A. 真溶液

B. 共轭溶液

C. 稀溶液

D. 理想溶液

2. 在相同温度下，有较高蒸气压的易挥发组分 A 在液相中的浓度 $x_A$ ，在气相中的浓度 $y_A$ ，则有：

A. $x_{A} > y_{A}$

B. $x_{A} < y_{A}$

C. $x_{A} = y_{A}$

D. $x_{\\mathrm{A}} = 0$

E. $y_{A} = 0$

3. 经典热力学研究：

（ ）

A. 非平衡态物质变化的宏观性质

B. 处于平衡态物质变化的宏观性质

C. 处于平衡态物质变化的速度和机理

D. 处于平衡态物质的结构

E. 以上都不是
"""

print("=" * 50)
print("测试1: 匹配完整题目块")
print("=" * 50)

# 尝试匹配完整题目（包括多行题干+多行选项）
pattern = r'(\d+)[.、]\s*(.+?)\s*\n\nA[.、]\s*(.+?)\n\nB[.、]\s*(.+?)\n\nC[.、]\s*(.+?)\n\nD[.、]\s*(.+?)(?:\n\nE[.、]\s*(.+?))?(?=\n\n\d+[.、]|$)'

matches = list(re.finditer(pattern, test_text, re.DOTALL))
print(f"找到 {len(matches)} 道题\n")

for m in matches:
    q_num = m.group(1)
    stem = m.group(2).strip()[:50]
    print(f"题目 {q_num}: {stem}...")
    print(f"  A: {m.group(3)[:20].strip()}...")
    print(f"  B: {m.group(4)[:20].strip()}...")
    print(f"  C: {m.group(5)[:20].strip()}...")
    print(f"  D: {m.group(6)[:20].strip()}...")
    if m.group(7):
        print(f"  E: {m.group(7)[:20].strip()}...")
    print()

print("=" * 50)
print("测试3: 匹配判断题")
print("=" * 50)

judge_text = """
1.化学势是偏摩尔内能。 （）
2. 凡定温定压下 ΔG 减少的过程都是自发过程。 （）
3.二组分固液平衡体系的自由度最多为3。 （）
"""

judge_pattern = r'(\d+)[.、]\s*(.+?。)\s*[(（]([\+\-])[)）]'
for m in re.finditer(judge_pattern, judge_text):
    q_num = m.group(1)
    stem = m.group(2).strip()
    answer = m.group(3)
    correct = 'true' if answer == '+' else 'false'
    print(f"题目 {q_num}: {stem} => 答案: {answer} ({correct})")

print()
print("=" * 50)
print("测试4: 匹配参考答案")
print("=" * 50)

answer_text = """
参考答案：

一、1. D；2. B；3. C；4. E；

5. B x 丙=1-0.3=0.7 若按理想溶液

P_{丙} = 323 × 0.7 = 226.1 mmHg
"""

# 单选题答案
ans_pattern = r'(\d+)[.、.\s]*\(?([A-E])\)?'
for m in re.finditer(ans_pattern, answer_text):
    print(f"题目 {m.group(1)}: 答案 = {m.group(2)}")