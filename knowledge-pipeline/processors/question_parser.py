# -*- coding: utf-8 -*-
"""
题目文件解析器

用于解析已有的题目文件，如：
- Markdown格式的题目（题干+选项+答案+解析）
- 转换为应用的 Question 格式
"""

import re
from typing import List, Dict, Optional, Tuple
from pathlib import Path


class QuestionParser:
    """题目解析器"""

    def __init__(self):
        # 题目类型标记
        self.current_subject_id = "general"
        self.current_chapter_id = "auto"
        self.kp_id_counter = 0

    def parse_markdown(self, text: str, subject_id: str = "general",
                       chapter_id: str = "auto") -> Tuple[List[Dict], List[Dict]]:
        """
        解析 Markdown 格式的题目文件

        支持的格式：
        - ## 第X题 或 **题干**：...
        - A. B. C. D. 选项
        - **答案**：X
        - **解析**：...

        Args:
            text: 文本内容
            subject_id: 学科ID
            chapter_id: 章节ID

        Returns:
            (questions列表, knowledge_points列表) - 题目和自动提取的知识点
        """
        self.current_subject_id = subject_id
        self.current_chapter_id = chapter_id

        questions = []
        knowledge_points = []

        # 分割成单个题目
        question_blocks = self._split_into_questions(text)

        # 第一步：先生成所有知识点，建立题干到kp_id的映射
        stem_to_kp_id = {}
        temp_knowledge_points = []

        for i, block in enumerate(question_blocks):
            kp_result = self._extract_kp_only(block, i + 1)
            if kp_result:
                stem, kp = kp_result
                temp_knowledge_points.append(kp)
                stem_to_kp_id[stem] = kp['id']

        # 第二步：生成题目，使用正确的kp_id
        for i, block in enumerate(question_blocks):
            q_result = self._parse_single_question_with_kp_map(block, i + 1, stem_to_kp_id)
            if q_result:
                question = q_result
                questions.append(question)

        knowledge_points = temp_knowledge_points

        print(f"  [解析器] 解析出 {len(questions)} 道题，{len(knowledge_points)} 个知识点")
        return questions, knowledge_points

    def _split_into_questions(self, text: str) -> List[str]:
        """将文本分割成单个题目块"""
        # 先清理速记表部分
        text = re.sub(r'\n---\s*\n.*$', '', text, flags=re.DOTALL)
        text = re.sub(r'\n###\s*速记核心对照表.*$', '', text, flags=re.DOTALL)

        # 先尝试用 ## 第X题 分割
        split_pattern = r'(?=##\s*第\d+题)'
        blocks = re.split(split_pattern, text.strip())

        # 如果没有分割成功，尝试其他模式
        if len(blocks) <= 1:
            split_pattern = r'(?=\*\*题干\*\*)'
            blocks = re.split(split_pattern, text.strip())

        # 过滤空块和过短的块，并且只保留包含题干的块
        valid_blocks = []
        for b in blocks:
            b = b.strip()
            if b and len(b) > 20:
                # 检查是否包含题干标识
                if '**题干**' in b or '题干：' in b:
                    valid_blocks.append(b)
                # 或者检查是否有选项格式
                elif re.search(r'\n\s*[A-Z][.、]\s*', b):
                    valid_blocks.append(b)

        return valid_blocks

    def _extract_kp_only(self, block: str, index: int) -> Optional[Tuple[str, Dict]]:
        """只提取知识点（用于第一遍扫描）"""
        stem = self._extract_stem(block)
        if not stem:
            return None

        explanation = self._extract_explanation(block)
        if not explanation or len(explanation) < 30:
            return None

        kp = self._extract_knowledge_from_explanation(stem, explanation, index)
        if kp:
            return (stem, kp)
        return None

    def _parse_single_question_with_kp_map(self, block: str, index: int, stem_to_kp_id: Dict[str, str]) -> Optional[Dict]:
        """解析单个题目，使用已建立的kp_id映射"""
        # 提取题干
        stem = self._extract_stem(block)
        if not stem:
            return None

        # 提取选项
        options = self._extract_options(block)
        if not options:
            return None

        # 提取答案
        correct_answers = self._extract_answers(block, options)
        if not correct_answers:
            return None

        # 提取解析
        explanation = self._extract_explanation(block)

        # 判断题型
        question_type = 'single_choice'
        if len(correct_answers) > 1:
            question_type = 'multi_choice'

        # 生成题目ID
        q_id = f"imported-q-{index}"

        # 获取正确的kp_id
        kp_id = stem_to_kp_id.get(stem, self._get_or_create_kp_id(stem))

        # 构建题目
        question = {
            'id': q_id,
            'knowledgePointId': kp_id,
            'subjectId': self.current_subject_id,
            'type': question_type,
            'stem': stem,
            'options': options,
            'correctAnswers': correct_answers,
            'explanation': explanation,
        }

        return question

    def _parse_single_question(self, block: str, index: int) -> Optional[Tuple[Dict, Optional[Dict]]]:
        """解析单个题目块（保留向后兼容）"""
        # 提取题干
        stem = self._extract_stem(block)
        if not stem:
            return None

        # 提取选项
        options = self._extract_options(block)
        if not options:
            return None

        # 提取答案
        correct_answers = self._extract_answers(block, options)
        if not correct_answers:
            return None

        # 提取解析
        explanation = self._extract_explanation(block)

        # 判断题型
        question_type = 'single_choice'
        if len(correct_answers) > 1:
            question_type = 'multi_choice'

        # 生成题目ID
        q_id = f"imported-q-{index}"

        # 构建题目
        question = {
            'id': q_id,
            'knowledgePointId': self._get_or_create_kp_id(stem),
            'subjectId': self.current_subject_id,
            'type': question_type,
            'stem': stem,
            'options': options,
            'correctAnswers': correct_answers,
            'explanation': explanation,
        }

        # 尝试从解析中提取知识点
        kp = self._extract_knowledge_from_explanation(stem, explanation, index)

        return (question, kp)

    def _extract_stem(self, block: str) -> Optional[str]:
        """提取题干"""
        # 模式1: **题干**：...
        match = re.search(r'\*\*题干\*\*[：:\s]*(.+?)(?=\n\s*[A-Z]\.|$)', block, re.DOTALL)
        if match:
            return match.group(1).strip()

        # 模式2: 题干：... （无**）
        match = re.search(r'题干[：:\s]*(.+?)(?=\n\s*[A-Z]\.|$)', block, re.DOTALL)
        if match:
            return match.group(1).strip()

        # 模式3: 直接在题目开头（## 第X题之后）
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        for i, line in enumerate(lines):
            # 跳过标题行
            if re.match(r'#{1,6}\s*第\d+题', line) or re.match(r'第\d+题', line):
                continue
            # 如果下一行是选项，这行就是题干
            if i + 1 < len(lines) and re.match(r'[A-Z][.、]\s*', lines[i + 1]):
                return line.strip()
            # 如果这行不是选项，且不是答案/解析，可能是题干
            if not re.match(r'[A-Z][.、]\s*', line) and not re.search(r'答案|解析', line):
                # 继续检查直到遇到选项
                stem_parts = []
                for j in range(i, len(lines)):
                    if re.match(r'[A-Z][.、]\s*', lines[j]) or re.search(r'答案|解析', lines[j]):
                        break
                    stem_parts.append(lines[j])
                if stem_parts:
                    return ' '.join(stem_parts).strip()

        return None

    def _extract_options(self, block: str) -> List[Dict]:
        """提取选项"""
        options = []

        # 先找到答案位置，只提取答案之前的内容作为选项
        answer_match = re.search(r'\n\s*\*\*答案|\n\s*答案', block)
        if answer_match:
            block_before_answer = block[:answer_match.start()]
        else:
            block_before_answer = block

        # 匹配 A. ... B. ... 格式
        # 更严格的模式：选项后面要么是下一个选项，要么是答案/解析，要么是结束
        option_pattern = r'([A-Z])[.、]\s*(.+?)(?=\n\s*[A-Z][.、]|\n\s*\*\*答案|\n\s*答案|$)'
        matches = re.findall(option_pattern, block_before_answer, re.DOTALL)

        seen_letters = set()
        for letter, text in matches:
            # 防止重复选项（同一字母只出现一次）
            if letter in seen_letters:
                continue
            seen_letters.add(letter)

            opt_id = letter.lower()
            # 清理选项文本
            text = text.strip()
            # 去除选项末尾可能带有的答案标记（如 ✅）
            text = re.sub(r'\s*[✅❌✓✗××]\s*$', '', text)
            text = re.sub(r'\s*\(\s*[正确错误]\s*\)\s*$', '', text)
            # 去除选项末尾的换行和多余内容
            text = text.split('\n')[0].strip()

            if text and len(text) < 500:  # 选项不会太长
                options.append({
                    'id': opt_id,
                    'text': text
                })

        return options

    def _extract_answers(self, block: str, options: List[Dict]) -> List[str]:
        """提取答案"""
        correct_answers = []

        # 模式1: **答案**：A
        match = re.search(r'\*\*答案\*\*[：:\s]*([A-Z,，\s]+)', block)
        if match:
            ans_text = match.group(1).strip()
            # 分割多个答案
            letters = re.split(r'[,，\s]+', ans_text)
            for letter in letters:
                letter = letter.strip().upper()
                if letter:
                    correct_answers.append(letter.lower())

        # 模式2: 答案：A （无**）
        if not correct_answers:
            match = re.search(r'答案[：:\s]*([A-Z,，\s]+)', block)
            if match:
                ans_text = match.group(1).strip()
                letters = re.split(r'[,，\s]+', ans_text)
                for letter in letters:
                    letter = letter.strip().upper()
                    if letter:
                        correct_answers.append(letter.lower())

        # 模式3: 从选项中的标记提取（如 A. xxx ✅）
        if not correct_answers:
            for opt in options:
                if re.search(r'[✅✓]|正确', opt['text']):
                    correct_answers.append(opt['id'])
                    # 清理选项文本中的标记
                    opt['text'] = re.sub(r'\s*[✅✓]\s*', '', opt['text'])
                    opt['text'] = re.sub(r'\s*\(\s*正确\s*\)\s*', '', opt['text'])

        # 验证答案是否在选项中
        option_ids = [o['id'] for o in options]
        correct_answers = [a for a in correct_answers if a in option_ids]

        return correct_answers

    def _extract_explanation(self, block: str) -> str:
        """提取解析"""
        # 模式1: **解析**：...
        match = re.search(r'\*\*解析\*\*[：:\s]*(.+?)(?=##\s*第\d+题|\n---|$)', block, re.DOTALL)
        if match:
            text = match.group(1).strip()
            # 清理速记表部分
            text = re.sub(r'\n---\s*\n.*$', '', text, flags=re.DOTALL)
            text = re.sub(r'\n###\s*速记核心对照表.*$', '', text, flags=re.DOTALL)
            return text.strip()

        # 模式2: 解析：... （无**）
        match = re.search(r'解析[：:\s]*(.+?)(?=##\s*第\d+题|\n---|$)', block, re.DOTALL)
        if match:
            text = match.group(1).strip()
            # 清理速记表部分
            text = re.sub(r'\n---\s*\n.*$', '', text, flags=re.DOTALL)
            text = re.sub(r'\n###\s*速记核心对照表.*$', '', text, flags=re.DOTALL)
            return text.strip()

        return ""

    def _get_or_create_kp_id(self, stem: str) -> str:
        """生成知识点ID（临时，后面可能会合并）"""
        # 从题干提取关键词作为临时ID
        keywords = re.sub(r'[^\u4e00-\u9fff\w]', '', stem[:30])
        return f"kp-temp-{keywords}"

    def _extract_knowledge_from_explanation(self, stem: str, explanation: str,
                                            index: int) -> Optional[Dict]:
        """从解析中提取知识点"""
        if not explanation:
            return None

        # 解析长度太短不行
        if len(explanation) < 30:
            return None

        # 生成知识点名称（从题干提取）
        name = self._make_kp_name(stem, index)

        self.kp_id_counter += 1
        from datetime import datetime
        kp_id = f"kp-imported-{datetime.now().strftime('%Y%m%d%H%M%S')}-{self.kp_id_counter:04d}"

        return {
            "id": kp_id,
            "subjectId": self.current_subject_id,
            "chapterId": self.current_chapter_id,
            "name": name,
            "explanation": explanation,
            "proficiency": "none",
            "lastReviewedAt": None,
            "nextReviewAt": datetime.now().isoformat(),
            "reviewCount": 0,
            "createdAt": datetime.now().isoformat(),
            "source": "import",
        }

    def _make_kp_name(self, stem: str, index: int) -> str:
        """从题干生成知识点名称"""
        stem_clean = stem

        # 去掉"下列"、"关于"等前缀
        stem_clean = re.sub(r'^下列[关于]?', '', stem_clean)
        stem_clean = re.sub(r'^关于', '', stem_clean)
        stem_clean = re.sub(r'^不属于', '', stem_clean)
        stem_clean = re.sub(r'^属于', '', stem_clean)

        # 去掉结尾的"的是"、"？"等
        stem_clean = re.sub(r'的\s*是[？?]?$', '', stem_clean)
        stem_clean = re.sub(r'[？?]$', '', stem_clean)
        stem_clean = stem_clean.strip()

        # 如果开头还有"于"字，去掉
        if stem_clean.startswith('于'):
            stem_clean = stem_clean[1:].strip()

        # 如果清理后太短，用"免疫学知识点X"
        if len(stem_clean) < 3:
            stem_clean = f"免疫学知识点{index}"

        # 截取合适长度
        if len(stem_clean) > 50:
            stem_clean = stem_clean[:50]

        return stem_clean

    def parse_file(self, file_path: str, subject_id: str = "general",
                   chapter_id: str = "auto") -> Tuple[List[Dict], List[Dict]]:
        """
        从文件解析题目

        Args:
            file_path: 文件路径
            subject_id: 学科ID
            chapter_id: 章节ID

        Returns:
            (questions列表, knowledge_points列表)
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        text = path.read_text(encoding='utf-8')
        return self.parse_markdown(text, subject_id, chapter_id)
