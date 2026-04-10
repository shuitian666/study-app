# -*- coding: utf-8 -*-
"""
PDF 文本提取器 - 增强版

功能：
1. 智能过滤前言、目录、版权页、页码等垃圾内容
2. 使用布局信息识别标题和正文
3. 跳过页眉页脚
4. 识别正文区域，只提取有效内容
"""

import re
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from collections import defaultdict

# 尝试导入 PDF 库
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    from PyPDF2 import PdfReader
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False


class PDFContentFilter:
    """PDF 内容过滤器 - 过滤垃圾内容"""

    # ===== 垃圾内容检测模式 =====

    # 行首垃圾关键词（匹配到就跳过整行）
    GARBAGE_LINE_STARTS = [
        # 版权信息
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

    # 行中包含的垃圾关键词
    GARBAGE_LINE_CONTAINS = [
        '版权所有', '未经授权', '翻印必究', '版板所有',
        '征订', '订购', '邮购', '经销', '发行部',
        '字数', '开本', '印张', '插页', '印数', '版次', '印次',
        'CIP数据', 'CIP核字',
        '电话', '传真', '邮编', '网址', 'Email', 'E-mail', '网页',
        '页眉', '页脚', '上接', '下转',
    ]

    # 目录页特征词
    TOC_KEYWORDS = ['目', '录', 'Contents', 'CONTENTS', '章', '节', '页码', '.......']

    # 正文最小长度
    MIN_CONTENT_LENGTH = 8

    # 识别目录页的阈值
    TOC_THRESHOLD = 0.3  # 超过30%的行包含目录特征词

    def __init__(self):
        self.page_stats = {}  # 页面统计信息

    def is_garbage_line(self, line: str) -> bool:
        """判断是否为垃圾内容行"""
        if not line or not line.strip():
            return True

        line_stripped = line.strip()

        # 太短的行可能是页码或分隔符
        if len(line_stripped) < self.MIN_CONTENT_LENGTH:
            # 检查是否是纯数字或符号
            if re.match(r'^[\d\s\-–—.,:;()（）\[\]【】]+$', line_stripped):
                return True
            return False

        # 检查行首垃圾模式
        for pattern in self.GARBAGE_LINE_STARTS:
            if re.search(pattern, line_stripped):
                return True

        # 检查包含垃圾关键词
        for keyword in self.GARBAGE_LINE_CONTAINS:
            if keyword in line_stripped:
                return True

        # 检查版权符号
        if re.search(r'©|®|™|§', line_stripped):
            return True

        # 检查邮箱或网址
        if re.search(r'[\w.-]+@[\w.-]+\.\w+|https?://|www\.', line_stripped):
            return True

        return False

    def is_toc_page(self, lines: List[str]) -> bool:
        """判断是否是目录页"""
        if not lines:
            return False

        toc_score = 0
        total_lines = len(lines)

        for line in lines:
            line_lower = line.lower()
            for kw in self.TOC_KEYWORDS:
                if kw.lower() in line_lower:
                    toc_score += 1
                    break
            # 检查目录典型的点线模式: "第一章...............10"
            if re.search(r'\.{5,}', line):
                toc_score += 1

        return (toc_score / total_lines) > self.TOC_THRESHOLD


class PDFSmartExtractor:
    """智能 PDF 提取器 - 使用布局信息"""

    def __init__(self):
        self.filter = PDFContentFilter()
        self.header_height = 0.08  # 顶部8%视为页眉
        self.footer_height = 0.08  # 底部8%视为页脚

    def extract_with_layout(self, pdf_path: str,
                           skip_pages: int = 0,
                           auto_detect_front_matter: bool = True) -> str:
        """
        使用布局信息提取文本

        Args:
            pdf_path: PDF 文件路径
            skip_pages: 手动跳过前 N 页
            auto_detect_front_matter: 自动检测并跳过前言/目录页

        Returns:
            清理后的文本
        """
        if not PDFPLUMBER_AVAILABLE:
            raise ImportError("需要 pdfplumber: pip install pdfplumber")

        text_parts = []
        front_matter_ended = False
        toc_pages_skipped = 0

        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            print(f"  [PDF] 总页数: {total_pages}")

            for page_num in range(total_pages):
                # 手动跳过指定页数
                if page_num < skip_pages:
                    print(f"  [PDF] 跳过第 {page_num + 1} 页（手动配置）")
                    continue

                page = pdf.pages[page_num]
                page_height = page.height
                page_width = page.width

                # 获取页面上的所有字符
                words = page.extract_words()

                if not words:
                    continue

                # 按行分组
                lines = self._group_words_by_line(words)

                # 自动检测前言/目录页（只在正文开始前检测）
                if auto_detect_front_matter and not front_matter_ended:
                    if self._is_front_matter_page(lines, page_num):
                        toc_pages_skipped += 1
                        print(f"  [PDF] 跳过第 {page_num + 1} 页（检测为前言/目录）")
                        continue
                    else:
                        front_matter_ended = True
                        if toc_pages_skipped > 0:
                            print(f"  [PDF] 共跳过 {toc_pages_skipped} 页前言/目录")

                # 过滤页眉页脚，提取正文
                clean_lines = self._filter_header_footer(lines, page_height)

                # 过滤垃圾内容行
                valid_lines = [line for line in clean_lines if not self.filter.is_garbage_line(line)]

                if valid_lines:
                    text_parts.append(f"\n--- 第 {page_num + 1} 页 ---\n")
                    text_parts.extend(valid_lines)

                if (page_num + 1) % 50 == 0:
                    print(f"  [PDF] 已处理 {page_num + 1}/{total_pages} 页")

        return "\n".join(text_parts)

    def _group_words_by_line(self, words: List[Dict]) -> List[Tuple[float, str]]:
        """将单词按行分组，返回 (y坐标, 文本)"""
        lines_dict = defaultdict(list)

        for word in words:
            # 使用单词的底部 y 坐标作为行标识（容差 3px）
            y_key = round(word['bottom'] / 3) * 3
            lines_dict[y_key].append((word['x0'], word['text']))

        # 按 y 坐标排序（从上到下）
        sorted_lines = []
        for y in sorted(lines_dict.keys()):
            # 同一行内按 x 坐标排序（从左到右）
            line_words = sorted(lines_dict[y], key=lambda x: x[0])
            line_text = ' '.join(w[1] for w in line_words)
            sorted_lines.append((y, line_text))

        return sorted_lines

    def _filter_header_footer(self, lines: List[Tuple[float, str]],
                              page_height: float) -> List[str]:
        """过滤页眉页脚"""
        valid_lines = []

        header_cutoff = page_height * self.header_height
        footer_cutoff = page_height * (1 - self.footer_height)

        for y, text in lines:
            # 跳过页眉区域
            if y < header_cutoff:
                continue
            # 跳过页脚区域
            if y > footer_cutoff:
                continue
            valid_lines.append(text)

        return valid_lines

    def _is_front_matter_page(self, lines: List[Tuple[float, str]], page_num: int) -> bool:
        """判断是否是前言/目录页"""
        # 前3页更可能是前言目录
        if page_num > 5:
            return False

        text_lines = [line for _, line in lines]

        # 检查是否是目录页
        if self.filter.is_toc_page(text_lines):
            return True

        # 检查是否有大量垃圾关键词
        garbage_count = sum(1 for line in text_lines if self.filter.is_garbage_line(line))
        if len(text_lines) > 0 and (garbage_count / len(text_lines)) > 0.5:
            return True

        return False


class PDFExtractor:
    """PDF 文本提取器 - 统一接口"""

    def __init__(self):
        self.library = None
        self.smart_extractor = None

        if PDFPLUMBER_AVAILABLE:
            self.library = "pdfplumber"
            self.smart_extractor = PDFSmartExtractor()
        elif PYPDF2_AVAILABLE:
            self.library = "pypdf2"
        else:
            raise ImportError("需要安装 pdfplumber 或 PyPDF2: pip install pdfplumber")

    def extract(self, file_path: str,
                start_page: int = 0,
                end_page: Optional[int] = None,
                smart: bool = True,
                skip_pages: int = 0,
                auto_detect_front_matter: bool = True) -> str:
        """
        从 PDF 提取文本

        Args:
            file_path: PDF 文件路径
            start_page: 起始页（0索引）
            end_page: 结束页（不含），None 表示到最后一页
            smart: 是否使用智能提取（推荐）
            skip_pages: 跳过前 N 页（仅智能模式）
            auto_detect_front_matter: 自动检测前言/目录（仅智能模式）

        Returns:
            提取的文本内容
        """
        if self.library == "pdfplumber" and smart:
            return self.smart_extractor.extract_with_layout(
                file_path,
                skip_pages=skip_pages,
                auto_detect_front_matter=auto_detect_front_matter
            )
        elif self.library == "pdfplumber":
            return self._extract_pdfplumber_simple(file_path, start_page, end_page)
        else:
            return self._extract_pypdf2(file_path, start_page, end_page)

    def _extract_pdfplumber_simple(self, file_path: str, start_page: int, end_page: Optional[int]) -> str:
        """使用 pdfplumber 简单提取（不使用布局）"""
        text_parts = []

        with pdfplumber.open(file_path) as pdf:
            total_pages = len(pdf.pages)
            end = end_page if end_page is not None else total_pages

            print(f"  [pdfplumber] 总页数: {total_pages}, 提取页数: {start_page}-{end}")

            for i in range(start_page, min(end, total_pages)):
                page = pdf.pages[i]
                page_text = page.extract_text()

                if page_text:
                    text_parts.append(f"\n--- 第 {i+1} 页 ---\n")
                    text_parts.append(page_text)

                if (i + 1) % 50 == 0:
                    print(f"  [pdfplumber] 已处理 {i+1}/{total_pages} 页")

        return "\n".join(text_parts)

    def _extract_pypdf2(self, file_path: str, start_page: int, end_page: Optional[int]) -> str:
        """使用 PyPDF2 提取"""
        text_parts = []
        reader = PdfReader(file_path)
        total_pages = len(reader.pages)
        end = end_page if end_page is not None else total_pages

        print(f"  [PyPDF2] 总页数: {total_pages}, 提取页数: {start_page}-{end}")

        for i in range(start_page, min(end, total_pages)):
            page = reader.pages[i]
            page_text = page.extract_text()

            if page_text:
                text_parts.append(f"\n--- 第 {i+1} 页 ---\n")
                text_parts.append(page_text)

            if (i + 1) % 50 == 0:
                print(f"  [PyPDF2] 已处理 {i+1}/{total_pages} 页")

        return "\n".join(text_parts)

    @staticmethod
    def is_available() -> bool:
        """检查是否可用"""
        return PDFPLUMBER_AVAILABLE or PYPDF2_AVAILABLE
