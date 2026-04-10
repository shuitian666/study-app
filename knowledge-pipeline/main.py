# -*- coding: utf-8 -*-
"""
知识处理流水线 - 主入口

用法:
    python main.py run --input <文件路径> --subject <学科名称>
    python main.py batch --dir <目录路径>
    python main.py upload --all
"""

import argparse
import sys
from pathlib import Path

# 添加父目录到路径，以便导入子模块
sys.path.insert(0, str(Path(__file__).parent))

from extractors import PDFExtractor, TxtExtractor, EpubExtractor
from processors import KnowledgeProcessor, KnowledgeReviewer, QuestionGenerator
from storage import LocalStorage, OSSUploader
from config import (
    PROJECT_ROOT, SOURCE_DIR, OUTPUT_DIR,
    DEFAULT_SUBJECTS, OSS_CONFIG, SUPPORTED_EXTENSIONS
)


def get_extractor(file_path: str):
    """根据文件扩展名获取合适的提取器"""
    ext = Path(file_path).suffix.lower()

    if ext == ".pdf":
        return PDFExtractor()
    elif ext == ".txt":
        return TxtExtractor()
    elif ext == ".epub":
        return EpubExtractor()
    else:
        raise ValueError(f"不支持的文件格式: {ext}")


def process_file(input_path: str, subject_name: str, subject_id: str = None,
                 upload: bool = False, verbose: bool = False, review: bool = True,
                 generate_questions: bool = True, smart_extract: bool = True,
                 skip_pages: int = 0):
    """
    处理单个文件

    Args:
        input_path: 输入文件路径
        subject_name: 学科名称
        subject_id: 学科ID（可选）
        upload: 是否上传到 OSS
        verbose: 是否显示详细信息
        review: 是否启用审核模式（默认启用）
        generate_questions: 是否自动生成题目
        smart_extract: 是否使用智能PDF提取（过滤前言/目录）
        skip_pages: 手动跳过前N页（仅PDF）
    """
    input_file = Path(input_path)
    if not input_file.exists():
        print(f"[ERROR] File not found: {input_path}")
        return

    # 确定学科 ID
    if subject_id is None:
        if subject_name in DEFAULT_SUBJECTS:
            subject_id = DEFAULT_SUBJECTS[subject_name]["id"]
        else:
            # 自动生成 ID
            subject_id = subject_name.lower().replace(" ", "_")[:20]

    print("=" * 50)
    print(f"[KNOWLEDGE PIPELINE]")
    print("=" * 50)
    print(f"Input: {input_path}")
    print(f"Subject: {subject_name}")
    print(f"Subject ID: {subject_id}")
    print(f"Upload OSS: {'Yes' if upload else 'No'}")
    print(f"Review Mode: {'Yes' if review else 'No'}")
    print(f"Generate Questions: {'Yes' if generate_questions else 'No'}")
    print(f"Smart PDF Extract: {'Yes' if smart_extract else 'No'}")
    print("-" * 50)

    # 步骤1: 提取文本
    print("\n[Step 1/5] Extracting text...")
    try:
        extractor = get_extractor(input_path)
        # 智能PDF提取选项
        if isinstance(extractor, PDFExtractor) and smart_extract:
            text = extractor.extract(
                input_path,
                smart=True,
                skip_pages=skip_pages,
                auto_detect_front_matter=True
            )
        else:
            text = extractor.extract(input_path)
        print(f"  [OK] Text length: {len(text)} chars")
    except Exception as e:
        print(f"  [FAIL] Extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return

    if not text.strip():
        print("  [FAIL] Extracted text is empty")
        return

    # 步骤2: 处理知识点
    print("\n[Step 2/5] Processing knowledge points...")
    try:
        processor = KnowledgeProcessor(subject_id=subject_id)
        knowledge_points = processor.process(text)
    except Exception as e:
        print(f"  [FAIL] Processing failed: {e}")
        import traceback
        traceback.print_exc()
        return

    if not knowledge_points:
        print("  [WARN] No knowledge points extracted")
        return

    # 步骤3: 自动生成题目
    questions = []
    if generate_questions:
        print("\n[Step 3/5] Generating questions...")
        try:
            q_generator = QuestionGenerator()
            questions = q_generator.batch_generate(
                knowledge_points,
                subject_id=subject_id,
                max_per_kp=2
            )
        except Exception as e:
            print(f"  [FAIL] Question generation failed: {e}")
            # 题目生成失败不影响知识点提取

    # 步骤4: 保存到待审核（如果启用审核）
    if review:
        print("\n[Step 4/5] Saving for review...")
        try:
            reviewer = KnowledgeReviewer(OUTPUT_DIR)
            # 将题目也保存到审核元数据中
            metadata = {
                "hasQuestions": len(questions) > 0,
                "questionCount": len(questions)
            }
            review_file = reviewer.save_for_review(
                knowledge_points,
                subject_name,
                metadata=metadata
            )
            print(f"  [OK] Review file: {review_file}")
            # 同时保存题目（单独文件）
            if questions:
                reviewer_data = reviewer.load_review_file(review_file)
                if reviewer_data:
                    reviewer_data["questions"] = questions
                    reviewer._save_review_data(reviewer_data, review_file)
                    print(f"  [OK] Saved {len(questions)} questions to review file")
            print("\n" + "=" * 50)
            print("[DONE] Please review the file and run 'finalize' command when ready")
            print("=" * 50)
            return  # 审核模式下不保存到最终目录，也不上传
        except Exception as e:
            print(f"  [FAIL] Review save failed: {e}")
            import traceback
            traceback.print_exc()
            return
    else:
        # 不启用审核时，直接保存
        print("\n[Step 4/5] Saving knowledge (no review)...")

    # 步骤5: 保存
    print("\n[Step 5/5] Saving knowledge...")
    try:
        storage = LocalStorage(OUTPUT_DIR)
        storage.save_knowledge(subject_id, subject_name, knowledge_points, questions)
    except Exception as e:
        print(f"  [FAIL] Save failed: {e}")
        import traceback
        traceback.print_exc()
        return

    # 上传到 OSS
    if upload:
        print("\n[Extra] Uploading to OSS...")
        try:
            uploader = OSSUploader(OSS_CONFIG)
            if uploader.enabled:
                uploader.upload_directory(OUTPUT_DIR / subject_name)
                uploader.upload_metadata(str(storage.metadata_file))
            else:
                print("  [SKIP] OSS not configured")
        except Exception as e:
            print(f"  [FAIL] Upload failed: {e}")

    print("\n" + "=" * 50)
    print("[DONE] Processing complete!")
    print("=" * 50)

    # 显示预览
    if verbose and knowledge_points:
        print("\n知识点预览 (前3个):")
        for i, kp in enumerate(knowledge_points[:3]):
            print(f"\n{i+1}. {kp['name']}")
            print(f"   {kp['explanation'][:80]}...")
    if questions:
        print(f"\n题目预览 (前3个):")
        for i, q in enumerate(questions[:3]):
            print(f"\n{i+1}. {q['stem']}")


def process_directory(dir_path: str, upload: bool = False, verbose: bool = False, review: bool = True,
                     generate_questions: bool = True, smart_extract: bool = True):
    """批量处理目录中的所有支持的文件"""
    dir_path = Path(dir_path)
    if not dir_path.exists() or not dir_path.is_dir():
        print(f"错误: 目录不存在 - {dir_path}")
        return

    # 收集所有支持的文件
    files_to_process = []
    for ext in SUPPORTED_EXTENSIONS:
        files_to_process.extend(dir_path.rglob(f"*{ext}"))

    if not files_to_process:
        print(f"在 {dir_path} 中未找到支持的文件")
        return

    print(f"找到 {len(files_to_process)} 个文件待处理")

    for file_path in files_to_process:
        # 尝试从文件名推断学科
        subject_name = file_path.stem  # 默认使用文件名作为学科名

        # 检查是否匹配已知学科
        for known_name in DEFAULT_SUBJECTS.keys():
            if known_name in file_path.name:
                subject_name = known_name
                break

        print(f"\n处理: {file_path.name}")
        process_file(str(file_path), subject_name, upload=upload, verbose=verbose,
                     review=review, generate_questions=generate_questions,
                     smart_extract=smart_extract)


def upload_all():
    """上传所有本地知识到 OSS"""
    print("=" * 50)
    print("📤 上传到 OSS")
    print("=" * 50)

    storage = LocalStorage(OUTPUT_DIR)
    stats = storage.get_stats()

    print(f"本地知识库统计:")
    print(f"  学科数: {stats['totalSubjects']}")
    print(f"  知识点: {stats['totalKnowledgePoints']}")
    print(f"  题    目: {stats['totalQuestions']}")
    print(f"  更新于: {stats['lastUpdated']}")

    if stats['totalSubjects'] == 0:
        print("\n没有可上传的知识库")
        return

    uploader = OSSUploader(OSS_CONFIG)
    if not uploader.enabled:
        print("\nOSS 未配置或不可用")
        return

    # 上传每个学科
    subjects = storage.list_subjects()
    for subject in subjects:
        print(f"\n上传: {subject['name']}...")
        uploader.upload_directory(subject["dir"])

    # 上传元数据
    print("\n上传元数据...")
    uploader.upload_metadata(str(storage.metadata_file))

    print("\n" + "=" * 50)
    print("[DONE] Upload complete!")
    print("=" * 50)


def finalize_review(review_file: str = None, upload: bool = False):
    """完成审核并上传到OSS"""
    print("=" * 50)
    print("[FINALIZE] Finalizing review and uploading")
    print("=" * 50)

    reviewer = KnowledgeReviewer(OUTPUT_DIR)

    # 如果没有指定文件，获取最近的待审核文件
    if not review_file:
        pending_files = reviewer.get_pending_files()
        if not pending_files:
            print("  [ERROR] No pending review files found")
            return
        # 按修改时间排序，取最新的
        review_file = str(sorted(pending_files, key=lambda p: p.stat().st_mtime, reverse=True)[0])
        print(f"  [INFO] Using most recent: {review_file}")

    # 加载审核文件
    data = reviewer.load_review_file(review_file)
    if not data:
        print("  [ERROR] Failed to load review file")
        return

    # 显示统计
    print(f"\n  Review Summary:")
    print(f"    Total: {data['stats']['total']}")
    print(f"    Approved: {data['stats']['approved']}")
    print(f"    Rejected: {data['stats']['rejected']}")

    # 获取题目（如果有）
    questions = data.get("questions", [])
    if questions:
        print(f"    Questions: {len(questions)}")

    # 完成审核
    result = reviewer.finalize_review(review_file)
    if not result:
        print("\n  [ERROR] No approved knowledge points to upload")
        return

    approved_kps, questions_from_review = result

    # 使用审核文件中的题目，如果有
    if questions_from_review:
        questions = questions_from_review

    # 获取学科信息
    subject_name = data.get("subjectName", "unknown")
    subject_id = data.get("metadata", {}).get("subjectId", "general")

    # 保存到最终目录
    print("\n  [SAVE] Saving approved knowledge points...")
    try:
        storage = LocalStorage(OUTPUT_DIR)
        storage.save_knowledge(subject_id, subject_name, approved_kps, questions)
        print(f"  [OK] Saved {len(approved_kps)} knowledge points")
        if questions:
            print(f"  [OK] Saved {len(questions)} questions")
    except Exception as e:
        print(f"  [FAIL] Save failed: {e}")
        import traceback
        traceback.print_exc()
        return

    # 上传到 OSS
    if upload:
        print("\n  [UPLOAD] Uploading to OSS...")
        try:
            uploader = OSSUploader(OSS_CONFIG)
            if uploader.enabled:
                uploader.upload_directory(OUTPUT_DIR / subject_name)
                uploader.upload_metadata(str(storage.metadata_file))
                print("  [OK] Upload complete")
            else:
                print("  [SKIP] OSS not configured")
        except Exception as e:
            print(f"  [FAIL] Upload failed: {e}")

    print("\n" + "=" * 50)
    print(f"[DONE] {len(approved_kps)} knowledge points finalized!")
    print("=" * 50)


def show_stats():
    """Show local knowledge base statistics"""
    storage = LocalStorage(OUTPUT_DIR)
    stats = storage.get_stats()

    print("=" * 50)
    print("[STATS] Local Knowledge Base")
    print("=" * 50)
    print(f"Subjects:   {stats['totalSubjects']}")
    print(f"Knowledge:  {stats['totalKnowledgePoints']}")
    print(f"Questions:  {stats['totalQuestions']}")
    print(f"Updated:    {stats['lastUpdated'] or 'Never'}")

    subjects = storage.list_subjects()
    if subjects:
        print("\nSubject List:")
        for s in subjects:
            print(f"  - {s['name']}: {s['kpCount']} KP, {s['qCount']} Q")


def main():
    parser = argparse.ArgumentParser(description="知识处理流水线")
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # run 命令 - 处理单个文件
    run_parser = subparsers.add_parser("run", help="处理单个文件")
    run_parser.add_argument("--input", "-i", required=True, help="输入文件路径")
    run_parser.add_argument("--subject", "-s", required=True, help="学科名称")
    run_parser.add_argument("--subject-id", help="学科ID（可选）")
    run_parser.add_argument("--upload", "-u", action="store_true", help="处理后上传到OSS")
    run_parser.add_argument("--verbose", "-v", action="store_true", help="显示详细信息")
    run_parser.add_argument("--no-review", action="store_true", help="跳过审核模式，直接保存")
    run_parser.add_argument("--no-questions", action="store_true", help="不自动生成题目")
    run_parser.add_argument("--no-smart", action="store_true", help="不使用智能PDF提取（不过滤前言/目录）")
    run_parser.add_argument("--skip-pages", type=int, default=0, help="手动跳过前N页（仅PDF）")

    # batch 命令 - 批量处理
    batch_parser = subparsers.add_parser("batch", help="批量处理目录")
    batch_parser.add_argument("--dir", "-d", required=True, help="输入目录路径")
    batch_parser.add_argument("--upload", "-u", action="store_true", help="处理后上传到OSS")
    batch_parser.add_argument("--verbose", "-v", action="store_true", help="显示详细信息")
    batch_parser.add_argument("--no-review", action="store_true", help="跳过审核模式，直接保存")
    batch_parser.add_argument("--no-questions", action="store_true", help="不自动生成题目")
    batch_parser.add_argument("--no-smart", action="store_true", help="不使用智能PDF提取")

    # upload 命令 - 上传到 OSS
    upload_parser = subparsers.add_parser("upload", help="上传到OSS")

    # stats 命令 - 显示统计
    stats_parser = subparsers.add_parser("stats", help="显示统计")

    # finalize 命令 - 完成审核并上传
    finalize_parser = subparsers.add_parser("finalize", help="完成审核并上传到OSS")
    finalize_parser.add_argument("--file", "-f", help="审核文件路径（默认使用最近的）")
    finalize_parser.add_argument("--upload", "-u", action="store_true", help="审核后上传到OSS")

    args = parser.parse_args()

    if args.command == "run":
        review_mode = not getattr(args, 'no_review', False)
        gen_questions = not getattr(args, 'no_questions', False)
        smart_extract = not getattr(args, 'no_smart', False)
        process_file(args.input, args.subject, args.subject_id,
                     args.upload, args.verbose, review=review_mode,
                     generate_questions=gen_questions, smart_extract=smart_extract,
                     skip_pages=args.skip_pages)
    elif args.command == "batch":
        review_mode = not getattr(args, 'no_review', False)
        gen_questions = not getattr(args, 'no_questions', False)
        smart_extract = not getattr(args, 'no_smart', False)
        process_directory(args.dir, args.upload, args.verbose, review=review_mode,
                         generate_questions=gen_questions, smart_extract=smart_extract)
    elif args.command == "upload":
        upload_all()
    elif args.command == "stats":
        show_stats()
    elif args.command == "finalize":
        finalize_review(args.file, args.upload)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
