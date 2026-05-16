# -*- coding: utf-8 -*-
"""
物理化学习题解析器 - 简化版

从 MinerU 导出的物理化学学习指导 markdown 文件中解析：
1. 判断题、单选题、多选题
2. 自动生成解析
"""

import re
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Optional


class PhysicalChemistryParser:
    """物理化学习题解析器"""

    def __init__(self, subject_id: str = "physical_chemistry"):
        self.subject_id = subject_id
        self.kp_id_counter = 0
        self.q_id_counter = 0
        self.knowledge_points = []
        self.questions = []

        # 章节信息
        self.chapters = [
            {"id": "phy-c1", "name": "综合试题一", "order": 1},
            {"id": "phy-c2", "name": "综合试题二", "order": 2},
            {"id": "phy-c3", "name": "综合试题三", "order": 3},
            {"id": "phy-c4", "name": "综合试题四", "order": 4},
            {"id": "phy-c5", "name": "综合试题五", "order": 5},
            {"id": "phy-c6", "name": "综合试题六", "order": 6},
            {"id": "phy-c7", "name": "综合试题七", "order": 7},
            {"id": "phy-c8", "name": "综合试题八", "order": 8},
        ]

    def parse(self, text: str) -> Tuple[List[Dict], List[Dict], List[Dict]]:
        """解析物理化学学习指导文件"""
        # 清理文本
        text = self._clean_text(text)

        # 解析各套试题
        self._parse_all_exams(text)

        return self.chapters, self.knowledge_points, self.questions

    def _clean_text(self, text: str) -> str:
        """清理文本"""
        text = re.sub(r'\r\n', '\n', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    def _parse_all_exams(self, text: str):
        """解析所有综合试题"""
        # 找到所有综合试题的位置
        exam_pattern = r'#\s*综合试题([一二三四五六七八])'
        exam_matches = list(re.finditer(exam_pattern, text))

        for exam_idx, match in enumerate(exam_matches):
            exam_num = match.group(1)
            exam_start = match.start()
            chapter_id = f"phy-c{exam_num_to_int(exam_num)}"

            # 确定结束位置
            if exam_idx + 1 < len(exam_matches):
                exam_end = exam_matches[exam_idx + 1].start()
            else:
                exam_end = len(text)

            exam_text = text[exam_start:exam_end]
            self._parse_single_exam(exam_text, chapter_id, f"综合试题{exam_num}")

        print(f"  [解析] 提取了 {len(self.questions)} 道题目")

    def _parse_single_exam(self, exam_text: str, chapter_id: str, exam_name: str):
        """解析单套试题"""
        # 解析判断题
        self._parse_judgment_questions(exam_text, chapter_id)
        # 解析单选题
        self._parse_choice_questions(exam_text, chapter_id)
        # 解析多选题
        self._parse_multi_questions(exam_text, chapter_id)

    def _parse_judgment_questions(self, exam_text: str, chapter_id: str):
        """解析判断题"""
        # 查找判断题部分 - 支持多种格式
        # 格式1: # 一、判断题： 或 一、判断题
        # 格式2: # （三）判断题
        # 格式3: 四、判断题（如错误，说明原因；每题1分，共8分）：
        section = None
        section_start = -1

        # 模式1: # 一、判断题： 或 一、判断题
        pattern1 = r'#\s*一、判断题[：:]?\s*\n'
        match = re.search(pattern1, exam_text)
        if match:
            section_start = match.end()
            # 找到下一个 # 参考答案 之前的内容
            ref_match = re.search(r'#\s*参考答案', exam_text[section_start:], re.IGNORECASE)
            if ref_match:
                section = exam_text[section_start:section_start + ref_match.start()]
            else:
                section = exam_text[section_start:]

        # 模式2: # （三）判断题
        if not section or len(section) < 50:
            pattern2 = r'#\s*（[一二三四五六七八]）判断题[：:]?\s*\n'
            match = re.search(pattern2, exam_text)
            if match:
                section_start = match.end()
                ref_match = re.search(r'#\s*参考答案', exam_text[section_start:], re.IGNORECASE)
                if ref_match:
                    section = exam_text[section_start:section_start + ref_match.start()]
                else:
                    section = exam_text[section_start:]

        # 模式3: 四、判断题（如错误，说明原因；每题1分，共8分）：
        if not section or len(section) < 50:
            pattern3 = r'四、判断题[^：]*：[^\n]*\n'
            match = re.search(pattern3, exam_text)
            if match:
                section_start = match.end()
                # 找到下一个选择题或填空题section之前
                next_section = re.search(r'#\s*[一二三四五六]、', exam_text[section_start:])
                if next_section:
                    section = exam_text[section_start:section_start + next_section.start()]
                else:
                    ref_match = re.search(r'#\s*参考答案', exam_text[section_start:], re.IGNORECASE)
                    if ref_match:
                        section = exam_text[section_start:section_start + ref_match.start()]

        # 模式4: 四、判断题：下列说法中对的打 $(+)$ ，错的打（-）（6分）
        if not section or len(section) < 50:
            pattern4 = r'四、判断题[^\n]*\n'
            match = re.search(pattern4, exam_text)
            if match:
                section_start = match.end()
                next_section = re.search(r'#\s*[一二三四五六]、', exam_text[section_start:])
                if next_section:
                    section = exam_text[section_start:section_start + next_section.start()]
                else:
                    ref_match = re.search(r'#\s*参考答案', exam_text[section_start:], re.IGNORECASE)
                    if ref_match:
                        section = exam_text[section_start:section_start + ref_match.start()]

        if not section or len(section) < 10:
            return

        # 匹配判断题: 数字. 题干(可选是否带括号答案)
        # 题干可能包含标点符号和LaTeX
        judge_pattern = r'(\d+)[.、.、]\s*([^\n]+?。)(?:\s*[（(]\s*[对错✓×+-]\s*[）)])?\s*(?:\n|$)'
        for q_match in re.finditer(judge_pattern, section):
            q_num = q_match.group(1)
            stem = q_match.group(2).strip()
            # 清理末尾的括号答案
            stem = re.sub(r'\s*[（(]\s*[对错✓×+-]\s*[）)]\s*$', '', stem)

            if len(stem) < 5:
                continue

            # 从参考答案获取答案
            answer = self._find_judgment_answer(exam_text, int(q_num))
            if not answer:
                continue

            correct = 'true' if answer in ['对', '✓', '+'] else 'false'

            # 生成解析
            explanation = f"根据物理化学原理，{stem[:30]}..."

            self.q_id_counter += 1
            question = {
                'id': f"phy-q-{self.q_id_counter:04d}",
                'knowledgePointId': self._find_related_kp(stem),
                'subjectId': self.subject_id,
                'type': 'true_false',
                'stem': stem,
                'options': [
                    {'id': 'true', 'text': '正确'},
                    {'id': 'false', 'text': '错误'},
                ],
                'correctAnswers': [correct],
                'explanation': explanation,
            }
            self.questions.append(question)

    def _parse_choice_questions(self, exam_text: str, chapter_id: str):
        """解析单选题"""
        # 匹配单选题: 数字. 题干 + 选项块
        # 选项之间有空行，所以用 \n\n
        pattern = r'(\d+)[.、]\s*(.+?)\s*\n\nA[.、]\s*(.+?)\n\nB[.、]\s*(.+?)\n\nC[.、]\s*(.+?)\n\nD[.、]\s*(.+?)(?:\n\nE[.、]\s*(.+?))?(?=\n\n\d+[.、]|\n\n[二三]\s*题|$)'

        for m in re.finditer(pattern, exam_text, re.DOTALL):
            q_num = m.group(1)
            stem = m.group(2).strip()
            options = [
                {'id': 'a', 'text': m.group(3).strip()},
                {'id': 'b', 'text': m.group(4).strip()},
                {'id': 'c', 'text': m.group(5).strip()},
                {'id': 'd', 'text': m.group(6).strip()},
            ]
            if m.group(7):
                options.append({'id': 'e', 'text': m.group(7).strip()})

            # 查找答案
            answer = self._find_answer(exam_text, int(q_num), 'single')
            if not answer or answer.lower() not in ['a', 'b', 'c', 'd', 'e']:
                continue

            # 生成解析
            correct_opt = next((o for o in options if o['id'] == answer.lower()), None)
            correct_text = correct_opt['text'][:50] if correct_opt else ""
            explanation = f"正确答案为{answer.upper()}。{stem[:20]}相关的正确概念是：{correct_text}..."

            self.q_id_counter += 1
            question = {
                'id': f"phy-q-{self.q_id_counter:04d}",
                'knowledgePointId': self._find_related_kp(stem),
                'subjectId': self.subject_id,
                'type': 'single_choice',
                'stem': stem,
                'options': options,
                'correctAnswers': [answer.lower()],
                'explanation': explanation,
            }
            self.questions.append(question)

    def _parse_multi_questions(self, exam_text: str, chapter_id: str):
        """解析多选题"""
        # 查找多选题部分
        pattern = r'(?:三[、.]?|四[、.]?)多项选择题[：:]?\s*\n((?:(?!\n[一二三四五六七八九十]\s*、|\n填空题|\n计算题|$).)*?)(?=\n[一二三四五六七八九十]\s*[、.]|\n填空题|\n计算题|$)'
        match = re.search(pattern, exam_text, re.DOTALL)
        if not match:
            return

        section = match.group(1)

        # 匹配多选题
        q_pattern = r'(\d+)[.、]\s*(.+?)\s*\n\nA[.、]\s*(.+?)\n\nB[.、]\s*(.+?)\n\nC[.、]\s*(.+?)\n\nD[.、]\s*(.+?)\n\nE[.、]\s*(.+?)(?=\n\n\d+[.、]|\n[一二三四五六七八九十]\s*[、.]|$)'

        for m in re.finditer(q_pattern, section, re.DOTALL):
            q_num = m.group(1)
            stem = m.group(2).strip()
            options = [
                {'id': 'a', 'text': m.group(3).strip()},
                {'id': 'b', 'text': m.group(4).strip()},
                {'id': 'c', 'text': m.group(5).strip()},
                {'id': 'd', 'text': m.group(6).strip()},
                {'id': 'e', 'text': m.group(7).strip()},
            ]

            # 查找答案
            answer_str = self._find_answer(exam_text, int(q_num), 'multi')
            if not answer_str:
                continue

            correct_answers = [c.lower() for c in answer_str if c.upper() in ['A', 'B', 'C', 'D', 'E']]
            if not correct_answers:
                continue

            # 生成解析
            correct_texts = [next((o['text'][:20] for o in options if o['id'] == ca), '') for ca in correct_answers]
            answers_str = "、".join([ca.upper() for ca in correct_answers])
            explanation = f"正确答案为{answers_str}。{', '.join(correct_texts[:3])}..."

            self.q_id_counter += 1
            question = {
                'id': f"phy-q-{self.q_id_counter:04d}",
                'knowledgePointId': self._find_related_kp(stem),
                'subjectId': self.subject_id,
                'type': 'multi_choice',
                'stem': stem,
                'options': options,
                'correctAnswers': correct_answers,
                'explanation': explanation,
            }
            self.questions.append(question)

    def _find_answer(self, exam_text: str, q_num: int, q_type: str) -> Optional[str]:
        """从参考答案部分查找答案"""
        # 找到参考答案部分
        ans_pattern = r'#?\s*参考答案[：:]?\s*\n'
        ans_match = re.search(ans_pattern, exam_text, re.IGNORECASE)
        if not ans_match:
            return None

        ans_section = exam_text[ans_match.end():]

        if q_type == 'single':
            # 单选题: 格式 "11. (B)" 或 "11.B"
            pattern = rf'{q_num}[.、.\s]*\(?([A-E])\)?'
            match = re.search(pattern, ans_section)
            if match:
                return match.group(1)
        elif q_type == 'multi':
            # 多选题: 可能和单选题格式相同
            pattern = rf'{q_num}[.、.\s]*\(?([A-CE]+)\)?'
            match = re.search(pattern, ans_section)
            if match:
                return match.group(1)

        return None

    def _find_judgment_answer(self, exam_text: str, q_num: int) -> Optional[str]:
        """从参考答案部分查找判断题答案"""
        # 找到参考答案部分
        ans_pattern = r'#?\s*参考答案[：:]?\s*\n'
        ans_match = re.search(ans_pattern, exam_text, re.IGNORECASE)
        if not ans_match:
            return None

        ans_section = exam_text[ans_match.end():]

        # 判断题答案格式: 多种格式
        # 格式1: "1.(-)" 或 "1. (-)" 或 "1、(-)"
        # 格式2: "1. 对" 或 "1. 错"
        # 格式3: "1. 对，2. 错，..."
        # 格式4: "1. 对 2. 错 3. 对..." (无逗号分隔)
        patterns = [
            rf'{q_num}[.、.\s]*\(?([\+\-])\)?',  # + 或 -
            rf'{q_num}[.、.\s]*(对|错)',           # 对 或 错
            rf'{q_num}[.、.\s]*(✓|×)',            # ✓ 或 ×
        ]

        for pattern in patterns:
            match = re.search(pattern, ans_section)
            if match:
                result = match.group(1)
                # 统一转换
                if result in ['+', '对', '✓']:
                    return '对'
                elif result in ['-', '错', '×']:
                    return '错'

        # 尝试在同一行中查找 "数字. 对/错" 或 "数字、 对/错" 格式（无逗号分隔）
        # 例如: "1. 对 2. 错 3. 对"
        line_pattern = rf'{q_num}[.、.\s]*(?:对|错|✓|×|[\+\-])'
        match = re.search(line_pattern, ans_section)
        if match:
            ans_line = match.group(0)
            if '对' in ans_line or '✓' in ans_line or '+' in ans_line:
                return '对'
            elif '错' in ans_line or '×' in ans_line or '-' in ans_line:
                return '错'

        return None

    def _find_related_kp(self, stem: str) -> str:
        """根据题干找到相关知识点"""
        for kp in self.knowledge_points:
            kp_name = kp.get('name', '')
            if any(word in stem for word in kp_name.split() if len(word) > 2):
                return kp['id']
        return f"phy-kp-default"

    def export(self, output_dir: str):
        """导出为 JSON 文件"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # 导出知识点
        index_data = {
            "version": "1.0",
            "subjectId": self.subject_id,
            "subjectName": "物理化学",
            "chapters": self.chapters,
            "knowledgePoints": self.knowledge_points,
        }

        index_file = output_path / f"物理化学_{timestamp}.json"
        with open(index_file, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)

        # 导出题目
        questions_data = {
            "version": "1.0",
            "subjectId": self.subject_id,
            "subjectName": "物理化学",
            "questions": self.questions,
        }

        questions_file = output_path / f"物理化学题目_{timestamp}.json"
        with open(questions_file, 'w', encoding='utf-8') as f:
            json.dump(questions_data, f, ensure_ascii=False, indent=2)

        print(f"  [导出] 知识点: {index_file}")
        print(f"  [导出] 题目: {questions_file}")

        return str(index_file), str(questions_file)


def exam_num_to_int(num: str) -> int:
    """转换中文数字为整数"""
    mapping = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8}
    return mapping.get(num, 0)


def main():
    import sys

    if len(sys.argv) < 2:
        print("用法: python physical_chemistry_parser.py <markdown文件路径>")
        sys.exit(1)

    input_file = sys.argv[1]

    print("=" * 50)
    print("[物理化学习题解析器]")
    print("=" * 50)
    print(f"输入: {input_file}")

    path = Path(input_file)
    if not path.exists():
        print(f"  [错误] 文件不存在")
        sys.exit(1)

    text = path.read_text(encoding='utf-8', errors='ignore')
    print(f"  [读取] 文件大小: {len(text)} 字符")

    # 解析
    parser = PhysicalChemistryParser(subject_id="physical_chemistry")
    chapters, knowledge_points, questions = parser.parse(text)

    print(f"\n解析结果:")
    print(f"  题目: {len(questions)}")

    # 导出
    output_dir = Path(__file__).parent / "output" / "物理化学"
    parser.export(str(output_dir))

    print("=" * 50)
    print("[完成]")


if __name__ == "__main__":
    main()