# -*- coding: utf-8 -*-
"""
知识点处理器 - 从文本中提取知识点
"""

import re
import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Set
from pathlib import Path

# 尝试导入中文分词库
try:
    import jieba
    import jieba.analyse
    JIEBA_AVAILABLE = True
except ImportError:
    JIEBA_AVAILABLE = False
    print("  [警告] jieba 未安装，关键词提取功能不可用。请运行: pip install jieba")


class KnowledgeProcessor:
    """知识点处理器"""

    # 中药/方剂相关的标题模式
    TITLE_PATTERNS = [
        # 方剂/中药名称（以 汤/散/丸/膏/饮/丹/煎/酒/剂 结尾）
        r'^([^\n]{2,30}?(?:汤|散|丸|膏|饮|丹|煎|酒|剂))\s*$',
        # 章节标题（第X章/第X节）
        r'^(第[一二三四五六七八九十百千零\d]+[章节部篇])[：:\s]*([^\n]*?)\s*$',
        # 数字编号 1. 2. 3.
        r'^(\d+[.、、][^\n]{2,30})\s*$',
        # 括号编号（1）（2）
        r'^（(\d+)[））][^\n]{2,30}\s*$',
    ]

    # 需要过滤的章节标题关键词
    FILTER_KEYWORDS = ['第', '章', '节', '篇', '单元', '总论', '各论', '附录', '参考书目', '索引']

    # ===== 新增：垃圾内容过滤模式 =====

    # 需要完全过滤的行首关键词（匹配到就跳过整行）
    GARBAGE_LINE_STARTS = [
        # 版权信息（最严格匹配）
        r'^本书.*版.*权', r'^版权.*所有', r'^©', r'^®', r'^™',
        r'^ISBN', r'^ISSN', r'^定价', r'^价\s*格', r'^价\s*¥', r'^¥\s*\d',
        r'^.*未经.*授权', r'^.*翻印必究', r'^.*版权所有',
        # 前言/目录/说明类
        r'^前言', r'^编写说明', r'^编写目的', r'^出版说明', r'^说明',
        r'^目录', r'^Contents', r'^目 录', r'^CONTENTS', r'^目录页',
        r'^参考文献', r'^参考文献列表', r'^参考书目', r'^索引',
        r'^附表', r'^附录', r'^附录\d', r'^附图',
        # 出版社/发行信息
        r'^出版社', r'^发行', r'^经销', r'^印刷',
        r'^地址', r'^邮编', r'^邮政编码', r'^邮发代号',
        r'^电话', r'^传真', r'^网址', r'^E-mail', r'^Email', r'^网页',
        r'^版次', r'^印次', r'^印数', r'^印张', r'^字数', r'^开本',
        # 页码相关
        r'^\d{1,4}$', r'^第?\d{1,4}页$', r'^第\d+页', r'^Page\s*\d+', r'^page\s*\d+',
        r'^\-\-\-\d+\-\-\-$',  # ---页码--- 格式
        # 日期相关
        r'^\d{4}年\d{1,2}月', r'^\d{4}-\d{2}-\d{2}', r'^\d{4}年\d+月\d+日',
        # 其他明显非正文
        r'^备注', r'^注释', r'^注\d+', r'^\d+注$', r'^※', r'^★', r'^☆', r'^●',
        r'^上接', r'^下转', r'^续表', r'^表\d', r'^图\d', r'^图版',
        r'^条码', r'^CIP',  # CIP 数据
    ]

    # 需要过滤的页眉页脚模式（包含以下关键词的行通常不是正文）
    GARBAGE_LINE_CONTAINS = [
        # 版权声明
        '版权所有', '未经授权', '翻印必究', '版板所有',
        # 发行信息
        '征订', '订购', '邮购', '经销', '发行部',
        # 出版信息
        '字数', '开本', '印张', '插页', '印数', '版次', '印次',
        'CIP数据', 'CIP核字',
        # 联系信息
        '电话', '传真', '邮编', '网址', 'Email', 'E-mail', '网页',
        # 其他非正文标记
        '页眉', '页脚', '上接', '下转',
    ]

    # 太短的行（少于8个字符）通常不是有效知识点
    MIN_CONTENT_LENGTH = 8

    # 标题最大长度（超过的不是有效标题）
    MAX_TITLE_LENGTH = 60

    # 正文最小长度（少于这个值的章节不是有效知识点）
    MIN_SECTION_LENGTH = 20

    def __init__(self, subject_id: str = "general", chapter_id: str = "auto"):
        self.subject_id = subject_id
        self.chapter_id = chapter_id
        self.kp_id_counter = 0

    def process(self, text: str) -> List[Dict]:
        """
        从文本中提取知识点

        Args:
            text: 原始文本

        Returns:
            知识点列表
        """
        # 清理文本
        text = self._clean_text(text)

        # 分割章节
        sections = self._split_into_sections(text)

        # 提取知识点
        knowledge_points = []
        for section in sections:
            kp = self._extract_knowledge_point(section)
            if kp:
                knowledge_points.append(kp)

        print(f"  [处理器] 共提取 {len(knowledge_points)} 个知识点")
        return knowledge_points

    def _clean_text(self, text: str) -> str:
        """清理文本"""
        # 去除多余空白
        text = re.sub(r'\r\n', '\n', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)

        # 去除特殊字符
        text = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]', '', text)

        return text.strip()

    def _split_into_sections(self, text: str) -> List[Dict]:
        """
        将文本分割成段落/章节

        Returns:
            [{"title": "标题", "content": "内容", "lines": [...]}, ...]
        """
        lines = text.split('\n')
        sections = []
        current_section = {"title": "", "content": "", "lines": []}

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # 检测是否为标题
            is_title = self._is_title(line)

            if is_title and current_section["lines"]:
                # 保存当前section，开始新的
                current_section["content"] = '\n'.join(current_section["lines"])
                if current_section["content"].strip():
                    sections.append(current_section)
                current_section = {"title": line, "content": "", "lines": [line]}
            else:
                current_section["lines"].append(line)

        # 保存最后一个section
        if current_section["lines"]:
            current_section["content"] = '\n'.join(current_section["lines"])
            if current_section["content"].strip():
                sections.append(current_section)

        return sections

    def _is_title(self, line: str) -> bool:
        """判断是否为标题"""
        # 跳过太短或太长的行
        if len(line) < 2 or len(line) > self.MAX_TITLE_LENGTH:
            return False

        # 跳过垃圾内容行
        if self._is_garbage_line(line):
            return False

        # 检查是否匹配标题模式
        for pattern in self.TITLE_PATTERNS:
            if re.match(pattern, line):
                # 进一步检查是否包含过滤关键词
                for kw in self.FILTER_KEYWORDS:
                    if kw in line:
                        return False
                return True

        return False

    def _is_garbage_line(self, line: str) -> bool:
        """
        判断是否为垃圾内容行（版权、页码、目录、前言等）

        Returns:
            True 表示是垃圾行，应该过滤
        """
        if not line:
            return True

        line_stripped = line.strip()
        if len(line_stripped) < self.MIN_CONTENT_LENGTH:
            return True

        # ========== 新增：多重检查机制 ==========

        # 1. 检查行首是否匹配垃圾模式（最优先）
        for pattern in self.GARBAGE_LINE_STARTS:
            if re.search(pattern, line_stripped):
                return True

        # 2. 检查是否包含垃圾关键词
        for keyword in self.GARBAGE_LINE_CONTAINS:
            if keyword in line_stripped:
                return True

        # 3. 检查是否全是数字、字母或符号（页码、编号等）
        # 如果行中汉字少于3个，且包含数字或符号，可能不是正文
        chinese_count = len(re.findall(r'[\u4e00-\u9fff]', line_stripped))
        if chinese_count < 3 and re.search(r'\d', line_stripped):
            # 可能是页码或编号
            if re.match(r'^[\d\s\-–—.,:;()（）\[\]【】]+$', line_stripped):
                return True

        # 4. 检查是否只有单字符重复（如 "━━━━━━"）
        if re.match(r'^([^\u4e00-\u9fff])\1{3,}$', line_stripped):
            return True

        # 5. 检查是否包含"第X页"模式
        if re.search(r'第\s*\d+\s*页', line_stripped):
            return True

        # 6. 检查是否有版权符号
        if re.search(r'©|®|™|§', line_stripped):
            return True

        # 7. 检查是否是对话框提示（如"上接"、"下转"）
        if re.search(r'^上接|^下转|^续表', line_stripped):
            return True

        # 8. 检查是否包含邮箱或网址
        if re.search(r'[\w.-]+@[\w.-]+\.\w+|https?://|www\.', line_stripped):
            return True

        return False

    def _extract_knowledge_point(self, section: Dict) -> Optional[Dict]:
        """从章节提取知识点"""
        title = section.get("title", "").strip()
        content = section.get("content", "").strip()

        if not title or not content:
            return None

        # 验证知识点内容的有效性
        if len(content) < self.MIN_SECTION_LENGTH:
            return None

        # ========== 新增：整体内容验证 ==========

        # 检查标题是否可能是垃圾
        for pattern in self.GARBAGE_LINE_STARTS:
            if re.search(pattern, title):
                return None

        # 检查标题是否包含垃圾关键词
        for keyword in self.GARBAGE_LINE_CONTAINS:
            if keyword in title:
                return None

        # 再次检查内容是否为垃圾（防止漏掉的垃圾内容）
        content_lines = [l for l in content.split('\n') if l.strip()]
        valid_lines = [l for l in content_lines if not self._is_garbage_line(l)]

        # 如果有效行少于2行，内容太短，或者有效内容占比低于50%，则丢弃
        if len(valid_lines) < 2:
            return None

        valid_ratio = len('\n'.join(valid_lines)) / max(len(content), 1)
        if valid_ratio < 0.5:
            return None

        # 检查内容中是否包含明显的垃圾特征
        garbage_indicators = ['版权所有', '未经授权', '定价', 'ISBN', '前言',
                              '目录', '编写说明', '第页', 'Page']
        content_lower = content.lower()
        for indicator in garbage_indicators:
            if indicator.lower() in content_lower and len(content) < 100:
                # 内容很短且包含垃圾关键词，大概率是垃圾
                return None

        # ========== 生成知识点 ==========
        self.kp_id_counter += 1
        kp_id = f"kp-{datetime.now().strftime('%Y%m%d%H%M%S')}-{self.kp_id_counter:04d}"

        # 提取关键词
        keywords = []
        if JIEBA_AVAILABLE and content:
            try:
                keywords = jieba.analyse.extract_tags(content, topK=5)
            except:
                pass

        # 提取摘要（前300字符）
        summary = self._extract_summary(content)

        # 构建知识点
        kp = {
            "id": kp_id,
            "subjectId": self.subject_id,
            "chapterId": self.chapter_id,
            "name": title,
            "explanation": summary,
            "proficiency": "none",
            "lastReviewedAt": None,
            "nextReviewAt": datetime.now().isoformat(),
            "reviewCount": 0,
            "createdAt": datetime.now().isoformat(),
            "source": "import",
            "keywords": keywords,
            "raw_text": content[:500] if len(content) > 500 else content
        }

        return kp

    def _extract_summary(self, content: str, max_length: int = 300) -> str:
        """提取摘要"""
        # 去掉标题行
        lines = content.split('\n')
        content_lines = [l for l in lines if l.strip() and l.strip() != self._get_title_from_content(content)]

        if not content_lines:
            return content[:max_length]

        # 取前N个有意义的句子
        sentences = []
        for line in content_lines:
            # 按句号、逗号、分号分割
            parts = re.split(r'[。；，,;]', line)
            for part in parts:
                part = part.strip()
                if len(part) >= 10:  # 过滤太短的
                    sentences.append(part)
                    if len('。'.join(sentences)) > max_length:
                        break
            if len('。'.join(sentences)) > max_length:
                break

        summary = '。'.join(sentences)
        if len(summary) > max_length:
            summary = summary[:max_length] + '...'

        return summary if summary else content[:max_length]

    def _get_title_from_content(self, content: str) -> str:
        """从内容中提取可能的标题"""
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            if line and len(line) >= 2 and len(line) <= 50:
                for pattern in self.TITLE_PATTERNS:
                    if re.match(pattern, line):
                        return line
        return ""

    def export_to_json(self, knowledge_points: List[Dict], output_path: str):
        """导出为 JSON 文件"""
        export_data = {
            "version": "1.0",
            "exportTime": datetime.now().isoformat(),
            "subjectId": self.subject_id,
            "total": len(knowledge_points),
            "knowledgePoints": knowledge_points
        }

        # 确保目录存在
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        print(f"  [导出] 已保存到: {output_path}")
        return output_path
