# -*- coding: utf-8 -*-
"""
存储模块
"""

from .local_storage import LocalStorage
from .oss_uploader import OSSUploader

__all__ = ["LocalStorage", "OSSUploader"]
