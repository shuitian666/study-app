# -*- coding: utf-8 -*-
"""
上传仪器分析知识库到 OSS
包含：紫外-可见光谱分析
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
    print("上传仪器分析知识库到 OSS")
    print("=" * 60)

    # 本地目录
    local_dir = Path(__file__).parent.parent / "output" / "instrumental_analysis"

    print(f"\n[1/2] 初始化 OSS 上传器...")

    uploader = OSSUploader(OSS_CONFIG)

    if not uploader.enabled:
        print("\n  [FAIL] OSS 未启用")
        return

    print(f"\n[2/2] 上传文件...")

    # 定义要上传的文件列表
    files_to_upload = [
        # metadata
        ("instrumental_analysis/metadata.json", "knowledge/instrumental_analysis/metadata.json"),
        # uv_spectroscopy
        ("uv_spectroscopy/index.json", "knowledge/instrumental_analysis/uv_spectroscopy/index.json"),
        ("uv_spectroscopy/chapters/basic_theory.json", "knowledge/instrumental_analysis/uv_spectroscopy/chapters/basic_theory.json"),
        ("uv_spectroscopy/chapters/quantitative.json", "knowledge/instrumental_analysis/uv_spectroscopy/chapters/quantitative.json"),
        ("uv_spectroscopy/chapters/chromophore.json", "knowledge/instrumental_analysis/uv_spectroscopy/chapters/chromophore.json"),
        ("uv_spectroscopy/questions/quiz_001.json", "knowledge/instrumental_analysis/uv_spectroscopy/questions/quiz_001.json"),
    ]

    success_count = 0
    for local_path, remote_path in files_to_upload:
        full_local = local_dir / local_path
        if full_local.exists():
            success = uploader.upload_file(str(full_local), remote_path)
            if success:
                success_count += 1
        else:
            print(f"  [SKIP] 文件不存在: {full_local}")

    print("\n" + "=" * 60)
    print(f"[OK] 上传完成! 成功上传 {success_count}/{len(files_to_upload)} 个文件")
    print("=" * 60)


if __name__ == "__main__":
    main()
