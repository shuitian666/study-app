# -*- coding: utf-8 -*-
"""
知识处理流水线配置
"""

import os
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.absolute()

# 源文件目录（放置待处理的 PDF/TXT/EPUB）
SOURCE_DIR = PROJECT_ROOT / "source"

# 输出目录（处理后的 JSON）
OUTPUT_DIR = PROJECT_ROOT / "output"

# 默认学科配置
DEFAULT_SUBJECTS = {
    "中药学": {
        "id": "tcm",
        "description": "中药学知识"
    },
    "方剂学": {
        "id": "fangji",
        "description": "方剂学知识"
    },
    "微生物与免疫学": {
        "id": "micro",
        "description": "微生物与免疫学知识"
    }
}

# 阿里云 OSS 配置 - 从环境变量读取
OSS_CONFIG = {
    "enabled": os.getenv("OSS_ENABLED", "false").lower() == "true",
    "access_key_id": os.getenv("OSS_ACCESS_KEY_ID", ""),
    "access_key_secret": os.getenv("OSS_ACCESS_KEY_SECRET", ""),
    "bucket": os.getenv("OSS_BUCKET", "zhixuestudy"),
    "region": os.getenv("OSS_REGION", "oss-cn-beijing")
}

# 知识点提取配置
KP_CONFIG = {
    "min_title_length": 2,      # 最小标题长度
    "max_title_length": 50,    # 最大标题长度
    "min_content_length": 20,  # 最小内容长度
    "extract_keywords": True,  # 是否提取关键词
    "max_keywords": 5          # 最大关键词数量
}

# 支持的文件格式
SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".epub", ".md"]

# 导出格式版本
EXPORT_VERSION = "1.0"
