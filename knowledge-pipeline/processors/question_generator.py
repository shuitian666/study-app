# -*- coding: utf-8 -*-
"""
题目生成器 - 从知识点自动生成题目

功能：
1. 从知识点自动生成单选题
2. 从知识点自动生成多选题
3. 从知识点自动生成判断题
4. 干扰项生成策略
"""

import re
import random
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass


@dataclass
class GeneratedQuestion:
    """生成的题目"""
    stem: str  # 题干
    type: str  # 'single_choice' | 'multi_choice' | 'true_false'
    options: List[Dict[str, str]]  # [{"id": "a", "text": "..."}, ...]
    correct_answers: List[str]  # 正确选项的 id 列表
    explanation: str  # 解析


class QuestionGenerator:
    """题目生成器"""

    def __init__(self):
        # 干扰词库 - 用于生成错误选项
        self.distractor_keywords = {
            # 中药相关干扰词
            'tcm': {
                '性味归经': ['性寒', '性温', '性凉', '性平', '味辛', '味苦', '味甘', '味酸', '味咸',
                           '归肺经', '归心经', '归脾经', '归肝经', '归肾经', '归胃经', '归膀胱经'],
                '功效': ['发汗解表', '清热解毒', '清热燥湿', '补气', '补血', '滋阴', '补阳',
                        '活血', '止血', '止咳', '平喘', '利水', '通便', '安神', '开窍'],
            },
            # 通用干扰词
            'general': {
                '是/不是': ['是', '不是'],
                '正确/错误': ['正确', '错误'],
                '包括/不包括': ['包括', '不包括'],
            }
        }

    def generate_from_knowledge_point(self, kp: Dict,
                                       question_type: str = 'auto',
                                       subject_id: str = 'general') -> List[GeneratedQuestion]:
        """
        从知识点生成题目

        Args:
            kp: 知识点字典，需包含 name 和 explanation 字段
            question_type: 题目类型 ('single_choice', 'multi_choice', 'true_false', 'auto')
            subject_id: 学科ID，用于选择合适的干扰词库

        Returns:
            生成的题目列表
        """
        name = kp.get('name', '')
        explanation = kp.get('explanation', '')

        if not name or not explanation:
            return []

        questions = []

        # 自动选择题目类型
        if question_type == 'auto':
            # 先尝试生成单选题
            q = self._generate_single_choice(name, explanation, subject_id)
            if q:
                questions.append(q)
            # 再尝试生成判断题
            q = self._generate_true_false(name, explanation)
            if q:
                questions.append(q)
        elif question_type == 'single_choice':
            q = self._generate_single_choice(name, explanation, subject_id)
            if q:
                questions.append(q)
        elif question_type == 'multi_choice':
            q = self._generate_multi_choice(name, explanation, subject_id)
            if q:
                questions.append(q)
        elif question_type == 'true_false':
            q = self._generate_true_false(name, explanation)
            if q:
                questions.append(q)

        return questions

    def _generate_single_choice(self, name: str, explanation: str,
                                 subject_id: str) -> Optional[GeneratedQuestion]:
        """生成单选题"""

        # 策略1: 提取"是/为"句式 - "X是Y"
        is_patterns = [
            r'(.+?)[为是]指?(.+?[。；；.])',
            r'^(.+?)[为是](.+?[。；；.])',
        ]

        for pattern in is_patterns:
            match = re.search(pattern, explanation)
            if match:
                term = match.group(1).strip()
                correct_def = match.group(2).strip()

                # 确保内容足够长
                if len(term) < 2 or len(correct_def) < 5:
                    continue

                # 生成干扰项
                distractors = self._generate_distractors_for_definition(
                    correct_def, subject_id
                )

                # 构建选项
                all_options = [correct_def] + distractors
                random.shuffle(all_options)

                options = []
                correct_ids = []
                for i, opt_text in enumerate(all_options):
                    opt_id = chr(97 + i)  # a, b, c, d...
                    options.append({'id': opt_id, 'text': opt_text})
                    if opt_text == correct_def:
                        correct_ids.append(opt_id)

                return GeneratedQuestion(
                    stem=f"{name}的定义是？",
                    type='single_choice',
                    options=options,
                    correct_answers=correct_ids,
                    explanation=f"{name}：{explanation[:200]}..."
                )

        # 策略2: 提取性味归经（中药专用）
        if subject_id == 'tcm' or '性' in explanation and '味' in explanation:
            nature_match = re.search(r'性[温凉寒热平]', explanation)
            taste_match = re.search(r'味[辛苦甘酸咸淡]', explanation)
            meridian_match = re.search(r'归[^。；；]+经', explanation)

            if nature_match or taste_match:
                correct = []
                if nature_match:
                    correct.append(nature_match.group(0))
                if taste_match:
                    correct.append(taste_match.group(0))
                if meridian_match:
                    correct.append(meridian_match.group(0))

                if correct:
                    correct_text = '，'.join(correct)

                    # 生成干扰选项
                    distractors = self._generate_tcm_distractors(correct)
                    all_options = [correct_text] + distractors[:3]
                    random.shuffle(all_options)

                    options = []
                    correct_ids = []
                    for i, opt_text in enumerate(all_options):
                        opt_id = chr(97 + i)
                        options.append({'id': opt_id, 'text': opt_text})
                        if opt_text == correct_text:
                            correct_ids.append(opt_id)

                    return GeneratedQuestion(
                        stem=f"{name}的性味归经是？",
                        type='single_choice',
                        options=options,
                        correct_answers=correct_ids,
                        explanation=f"{name}：{explanation[:200]}..."
                    )

        # 策略3: "不包括"类型题目
        include_pattern = r'(.+?)[包括有][：:](.+?)[。；；.]'
        match = re.search(include_pattern, explanation)
        if match:
            items_str = match.group(2).strip()
            items = re.split(r'[、，,；；]', items_str)
            items = [i.strip() for i in items if len(i.strip()) >= 2]

            if len(items) >= 3:
                # 选一个作为正确答案（不包括的）
                correct_include = items[:3]
                # 生成一个干扰项
                distractor = self._generate_related_distractor(items[0], explanation)

                options = []
                all_items = correct_include + [distractor]
                random.shuffle(all_items)

                correct_ids = []
                for i, item in enumerate(all_items):
                    opt_id = chr(97 + i)
                    options.append({'id': opt_id, 'text': item})
                    if item == distractor:
                        correct_ids.append(opt_id)

                return GeneratedQuestion(
                    stem=f"下列哪项{name}不包括？",
                    type='single_choice',
                    options=options,
                    correct_answers=correct_ids,
                    explanation=f"{name}包括：{items_str}。"
                )

        return None

    def _generate_multi_choice(self, name: str, explanation: str,
                                subject_id: str) -> Optional[GeneratedQuestion]:
        """生成多选题"""
        # 提取包含多项的句子
        include_pattern = r'(.+?)[包括有功效主治为][：:](.+?)[。；；.]'
        match = re.search(include_pattern, explanation)

        if match:
            items_str = match.group(2).strip()
            items = re.split(r'[、，,；；]', items_str)
            items = [i.strip() for i in items if len(i.strip()) >= 2]

            if len(items) >= 3:
                # 正确选项：选3个
                correct_items = items[:3]

                # 干扰选项：生成1-2个
                distractors = []
                for _ in range(2):
                    dist = self._generate_related_distractor(items[0], explanation)
                    if dist not in items and dist not in distractors:
                        distractors.append(dist)

                all_options = correct_items + distractors[:2]
                random.shuffle(all_options)

                options = []
                correct_ids = []
                for i, item in enumerate(all_options):
                    opt_id = chr(97 + i)
                    options.append({'id': opt_id, 'text': item})
                    if item in correct_items:
                        correct_ids.append(opt_id)

                return GeneratedQuestion(
                    stem=f"{name}包括哪些？（多选）",
                    type='multi_choice',
                    options=options,
                    correct_answers=correct_ids,
                    explanation=f"{name}：{explanation[:200]}..."
                )

        return None

    def _generate_true_false(self, name: str, explanation: str) -> Optional[GeneratedQuestion]:
        """生成判断题"""

        # 策略1: 提取一个陈述句，生成正确的判断
        sentences = re.split(r'[。！？!?.]', explanation)
        sentences = [s.strip() for s in sentences if len(s.strip()) >= 10]

        if sentences:
            true_sentence = sentences[0]

            # 生成错误的句子
            false_sentence = self._modify_to_false(true_sentence, name)

            # 随机选择是出正确题还是错误题
            if random.random() > 0.5:
                # 出正确的题
                return GeneratedQuestion(
                    stem=f'"{name}：{true_sentence}"，该说法是否正确？',
                    type='true_false',
                    options=[
                        {'id': 'a', 'text': '正确'},
                        {'id': 'b', 'text': '错误'},
                    ],
                    correct_answers=['a'],
                    explanation=f"正确。{name}：{explanation[:150]}..."
                )
            else:
                # 出错误的题
                return GeneratedQuestion(
                    stem=f'"{name}：{false_sentence}"，该说法是否正确？',
                    type='true_false',
                    options=[
                        {'id': 'a', 'text': '正确'},
                        {'id': 'b', 'text': '错误'},
                    ],
                    correct_answers=['b'],
                    explanation=f"错误。正确说法是：{true_sentence}。"
                )

        return None

    def _generate_distractors_for_definition(self, correct: str,
                                               subject_id: str) -> List[str]:
        """为定义题生成干扰项"""
        distractors = []

        # 策略1: 替换关键词
        if '性' in correct:
            d = correct.replace('性寒', '性温').replace('性温', '性寒')
            if d != correct and d not in distractors:
                distractors.append(d)

        if '寒' in correct:
            d = correct.replace('寒', '热').replace('热', '寒')
            if d != correct and d not in distractors:
                distractors.append(d)

        # 策略2: 截取部分内容
        words = correct.split('，')
        if len(words) >= 2:
            d = '，'.join(words[:-1])
            if len(d) >= 5 and d not in distractors:
                distractors.append(d)

        # 策略3: 补充无关内容
        if subject_id == 'tcm':
            extra = random.choice(['', '，清热解毒', '，补气养血', '，止咳平喘'])
            if extra:
                d = correct + extra
                if d != correct and d not in distractors:
                    distractors.append(d)

        # 确保有3个干扰项
        while len(distractors) < 3:
            # 使用通用干扰
            templates = [
                '以上都不是',
                '以上都是',
                '没有正确答案',
                f'是关于{correct[:10]}的其他说法',
            ]
            d = random.choice(templates)
            if d not in distractors:
                distractors.append(d)

        return distractors[:3]

    def _generate_tcm_distractors(self, correct_parts: List[str]) -> List[str]:
        """生成中药性味归经的干扰项"""
        distractors = []

        natures = ['性寒', '性温', '性凉', '性平', '性热']
        tastes = ['味辛', '味苦', '味甘', '味酸', '味咸']
        meridians = ['归肺经', '归心经', '归脾经', '归肝经', '归肾经', '归胃经', '归膀胱经']

        for _ in range(3):
            parts = []
            # 随机替换性味归经
            for part in correct_parts:
                if '性' in part:
                    d = random.choice([n for n in natures if n != part])
                    parts.append(d)
                elif '味' in part:
                    d = random.choice([t for t in tastes if t != part])
                    parts.append(d)
                elif '归' in part:
                    d = random.choice([m for m in meridians if m != part])
                    parts.append(d)
                else:
                    parts.append(part)

            d_text = '，'.join(parts)
            if d_text not in distractors:
                distractors.append(d_text)

        return distractors[:3]

    def _generate_related_distractor(self, example: str, explanation: str) -> str:
        """生成相关的干扰项"""
        # 简单策略：从 explanation 中提取其他词
        words = re.split(r'[、，,；；。！？!?.\s]', explanation)
        words = [w.strip() for w in words if len(w.strip()) >= 2 and w.strip() != example]

        if words:
            return random.choice(words)

        # 兜底
        return '其他内容'

    def _modify_to_false(self, sentence: str, name: str) -> str:
        """将正确句子修改为错误句子"""

        # 策略1: 替换关键词
        replacements = [
            ('寒', '热'), ('热', '寒'), ('温', '凉'), ('凉', '温'),
            ('是', '不是'), ('包括', '不包括'), ('有', '没有'),
            ('归肺', '归心'), ('归心', '归肺'), ('归脾', '归肝'),
            ('补气', '补血'), ('补血', '补气'), ('滋阴', '补阳'),
        ]

        for old, new in replacements:
            if old in sentence:
                return sentence.replace(old, new, 1)

        # 策略2: 添加否定词
        if '为' in sentence:
            return sentence.replace('为', '不为', 1)
        if '是' in sentence:
            return sentence.replace('是', '不是', 1)

        # 策略3: 简单添加"不"
        return '不' + sentence if sentence else sentence

    def batch_generate(self, knowledge_points: List[Dict],
                       subject_id: str = 'general',
                       max_per_kp: int = 2) -> List[Dict]:
        """
        批量生成题目

        Args:
            knowledge_points: 知识点列表
            subject_id: 学科ID
            max_per_kp: 每个知识点最多生成几道题

        Returns:
            题目列表，格式符合应用的 Question 类型
        """
        all_questions = []
        question_id_counter = 0

        for kp in knowledge_points:
            kp_id = kp.get('id', '')
            if not kp_id:
                continue

            # 生成题目
            generated = self.generate_from_knowledge_point(kp, 'auto', subject_id)

            # 限制数量
            generated = generated[:max_per_kp]

            # 转换为应用格式
            for q in generated:
                question_id_counter += 1
                q_id = f"gen-q-{question_id_counter}"

                all_questions.append({
                    'id': q_id,
                    'knowledgePointId': kp_id,
                    'subjectId': subject_id,
                    'type': q.type,
                    'stem': q.stem,
                    'options': q.options,
                    'correctAnswers': q.correct_answers,
                    'explanation': q.explanation,
                })

        print(f"  [出题] 从 {len(knowledge_points)} 个知识点生成了 {len(all_questions)} 道题")
        return all_questions
