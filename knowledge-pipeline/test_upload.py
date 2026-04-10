# -*- coding: utf-8 -*-
"""
测试 OSS 上传功能
"""

import sys
import io
from pathlib import Path

# 设置默认输出编码为UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.insert(0, str(Path(__file__).parent))

from config import OSS_CONFIG, OUTPUT_DIR
from storage import OSSUploader


def main():
    print("=" * 60)
    print("OSS 上传测试")
    print("=" * 60)

    # 要上传的目录
    subject_dir = OUTPUT_DIR / "免疫学题目"

    print(f"\n[1/2] 初始化 OSS 上传器...")
    print(f"  Bucket: {OSS_CONFIG['bucket']}")
    print(f"  Region: {OSS_CONFIG['region']}")

    uploader = OSSUploader(OSS_CONFIG)

    if not uploader.enabled:
        print("\n  [FAIL] OSS 未启用，无法上传")
        print("  请检查 config.py 中的 OSS_CONFIG")
        return

    print(f"\n[2/2] 上传目录: {subject_dir}")

    # 检查目录是否存在
    if not subject_dir.exists():
        print(f"  [FAIL] 目录不存在: {subject_dir}")
        return

    # 列出要上传的文件
    files = list(subject_dir.glob("*"))
    print(f"  发现 {len(files)} 个文件:")
    for f in files:
        print(f"    - {f.name}")

    # 执行上传
    print(f"\n  开始上传...")
    success_count = uploader.upload_directory(
        str(subject_dir),
        remote_prefix="免疫学题目"
    )

    print("\n" + "=" * 60)
    if success_count > 0:
        print(f"[OK] 上传完成! 成功上传 {success_count} 个文件")
    else:
        print("[FAIL] 上传失败")
    print("=" * 60)


if __name__ == "__main__":
    main()
