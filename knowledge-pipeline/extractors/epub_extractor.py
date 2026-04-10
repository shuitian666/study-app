# -*- coding: utf-8 -*-
"""
EPUB 文本提取器
"""

import re
import zipfile
from pathlib import Path
from typing import Optional


class EpubExtractor:
    """EPUB 文本提取器"""

    def extract(self, file_path: str) -> str:
        """
        从 EPUB 文件提取文本

        Args:
            file_path: EPUB 文件路径

        Returns:
            提取的文本内容
        """
        text_parts = []

        try:
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                # 获取所有 HTML/XHTML 文件
                html_files = [
                    f for f in zip_ref.namelist()
                    if f.endswith(('.xhtml', '.html', '.htm'))
                ]
                print(f"  [EPUB] 找到 {len(html_files)} 个 HTML 文件")

                # 按顺序处理（排序保证章节顺序）
                html_files.sort()

                for i, file in enumerate(html_files):
                    try:
                        content = zip_ref.read(file).decode('utf-8', errors='ignore')

                        # 去除 HTML 标签
                        text = self._strip_html_tags(content)

                        # 去除多余空白
                        text = re.sub(r'\s+', ' ', text).strip()

                        if text:
                            text_parts.append(text)

                        if (i + 1) % 50 == 0:
                            print(f"  [EPUB] 已处理 {i+1}/{len(html_files)} 文件")

                    except Exception as e:
                        print(f"  [EPUB] 警告: 处理 {file} 时出错: {e}")
                        continue

        except zipfile.BadZipFile:
            raise ValueError(f"无效的 EPUB 文件: {file_path}")
        except Exception as e:
            raise ValueError(f"EPUB 解析失败: {e}")

        return "\n\n".join(text_parts)

    def _strip_html_tags(self, html: str) -> str:
        """去除 HTML 标签"""
        # 去除 <style> 和 <script> 标签及其内容
        html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)

        # 去除所有 HTML 标签
        html = re.sub(r'<[^>]+>', '', html)

        # 转换 HTML 实体
        html = html.replace('&nbsp;', ' ')
        html = html.replace('&lt;', '<')
        html = html.replace('&gt;', '>')
        html = html.replace('&amp;', '&')
        html = html.replace('&quot;', '"')
        html = html.replace('&#39;', "'")
        html = html.replace('&apos;', "'")

        return html

    @staticmethod
    def is_available() -> bool:
        """检查是否可用 - EPUB 提取器始终可用（使用标准库）"""
        return True
