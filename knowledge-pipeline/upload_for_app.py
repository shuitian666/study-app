# -*- coding: utf-8 -*-
"""
上传符合 App 格式的知识库到 OSS
"""

import sys
import io
from pathlib import Path

# 设置默认输出编码为UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.insert(0, str(Path(__file__).parent))

from config import OSS_CONFIG
from storage import OSSUploader


def main():
    print("=" * 60)
    print("上传知识库到 App OSS")
    print("=" * 60)

    # 本地文件
    local_file = Path(__file__).parent.parent / "output" / "免疫学题目" / "oss_ready.json"

    print(f"\n[1/2] 初始化 OSS 上传器...")

    uploader = OSSUploader(OSS_CONFIG)

    if not uploader.enabled:
        print("\n  [FAIL] OSS 未启用")
        return

    print(f"\n[2/2] 上传文件...")
    print(f"  本地: {local_file}")
    print(f"  远程: knowledge/immuno/index.json")

    success = uploader.upload_file(str(local_file), "knowledge/immuno/index.json")

    print("\n" + "=" * 60)
    if success:
        print("[OK] 上传完成!")
        print("URL: https://zhixuestudy.oss-cn-beijing.aliyuncs.com/knowledge/immuno/index.json")
    else:
        print("[FAIL] 上传失败")
    print("=" * 60)


if __name__ == "__main__":
    main()
