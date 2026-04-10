# -*- coding: utf-8 -*-
"""
文本提取器模块
"""

from .pdf_extractor import PDFExtractor
from .txt_extractor import TxtExtractor
from .epub_extractor import EpubExtractor

__all__ = ["PDFExtractor", "TxtExtractor", "EpubExtractor"]
