# -*- coding: utf-8 -*-
"""
阿里云 OSS 上传模块
"""

import os
import json
from pathlib import Path
from typing import Optional, Dict


class OSSUploader:
    """阿里云 OSS 上传器"""

    def __init__(self, config: Dict = None):
        """
        初始化 OSS 上传器

        Args:
            config: OSS 配置，包含 access_key_id, access_key_secret, bucket, region 等
        """
        self.config = config or {}
        self.client = None
        self.enabled = False

        # 检查是否配置了 OSS
        if self._check_config():
            self._init_client()

    def _check_config(self) -> bool:
        """检查配置是否完整"""
        required_keys = ["access_key_id", "access_key_secret", "bucket", "region"]
        for key in required_keys:
            if not self.config.get(key):
                print(f"  [OSS] 警告: 缺少配置项 {key}")
                return False
        return True

    def _init_client(self):
        """初始化 OSS 客户端"""
        try:
            import oss2
            self.enabled = True

            # 创建 OSS 客户端
            auth = oss2.Auth(
                self.config["access_key_id"],
                self.config["access_key_secret"]
            )
            # endpoint 格式: oss-cn-beijing.aliyuncs.com (不带 https://)
            endpoint = self.config["region"] + ".aliyuncs.com"
            self.client = oss2.Bucket(
                auth,
                endpoint,
                self.config["bucket"]
            )
            print(f"  [OSS] 已连接到 Bucket: {self.config['bucket']} ({endpoint})")
        except ImportError:
            print("  [OSS] 警告: ali-oss 未安装，上传功能不可用。请运行: pip install oss2")
        except Exception as e:
            print(f"  [OSS] 初始化失败: {e}")

    def upload_file(self, local_path: str, remote_path: str = None) -> bool:
        """
        上传单个文件到 OSS

        Args:
            local_path: 本地文件路径
            remote_path: OSS 上的路径，默认使用文件名

        Returns:
            是否成功
        """
        if not self.enabled:
            print("  [OSS] 未启用，跳过上传")
            return False

        if remote_path is None:
            remote_path = Path(local_path).name

        try:
            print(f"  [OSS] 上传: {local_path} -> {remote_path}")
            result = self.client.put_object_from_file(remote_path, local_path)
            if result.status == 200:
                print(f"  [OSS] 上传成功: https://{self.config['bucket']}.{self.config['region']}.aliyuncs.com/{remote_path}")
                return True
            else:
                print(f"  [OSS] 上传失败: status={result.status}")
                return False
        except Exception as e:
            print(f"  [OSS] 上传出错: {e}")
            return False

    def upload_directory(self, local_dir: str, remote_prefix: str = "") -> int:
        """
        上传整个目录到 OSS

        Args:
            local_dir: 本地目录
            remote_prefix: OSS 上的路径前缀

        Returns:
            成功上传的文件数
        """
        if not self.enabled:
            print("  [OSS] 未启用，跳过上传")
            return 0

        local_dir = Path(local_dir)
        if not local_dir.exists():
            print(f"  [OSS] 目录不存在: {local_dir}")
            return 0

        success_count = 0
        for file_path in local_dir.rglob("*"):
            if file_path.is_file():
                # 计算远程路径
                relative_path = file_path.relative_to(local_dir)
                remote_path = f"{remote_prefix}/{relative_path}" if remote_prefix else str(relative_path)

                if self.upload_file(str(file_path), remote_path):
                    success_count += 1

        print(f"  [OSS] 共成功上传 {success_count} 个文件")
        return success_count

    def upload_metadata(self, local_metadata_path: str) -> bool:
        """上传元数据文件"""
        return self.upload_file(local_metadata_path, "metadata.json")

    @staticmethod
    def is_available() -> bool:
        """检查 OSS 模块是否可用"""
        try:
            import oss2
            return True
        except ImportError:
            return False
