# -*- coding: utf-8 -*-
"""
TXT 文本提取器
"""

import re
from pathlib import Path


class TxtExtractor:
    """TXT 文本提取器"""

    # 支持的编码
    ENCODINGS = ['utf-8', 'gbk', 'gb2312', 'gb18030', 'big5']

    def extract(self, file_path: str) -> str:
        """
        从 TXT 文件提取文本

        Args:
            file_path: TXT 文件路径

        Returns:
            提取的文本内容
        """
        # 尝试不同编码
        for encoding in self.ENCODINGS:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                print(f"  [TXT] 成功使用 {encoding} 编码读取")
                return content
            except UnicodeDecodeError:
                continue

        # 最后尝试忽略错误读取
        print(f"  [TXT] 尝试忽略错误读取（encoding='utf-8', errors='ignore'）")
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()

    @staticmethod
    def is_available() -> bool:
        """检查是否可用 - TXT 提取器始终可用"""
        return True
