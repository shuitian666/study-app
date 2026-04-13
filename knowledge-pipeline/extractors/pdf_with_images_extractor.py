# -*- coding: utf-8 -*-
"""
PDF 文本+图片提取器 - 保持内容对应关系

功能：
1. 提取PDF文本内容（按块、带坐标）
2. 提取PDF中的内嵌图片并保存
3. 保持文本和图片的对应关系（按页面、按位置）
4. 输出结构化JSON数据，方便其他AI处理
5. 支持图片Base64编码
"""

import re
import json
import base64
import io
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from dataclasses import dataclass, asdict
from datetime import datetime

# 尝试导入 PDF 库
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


@dataclass
class PDFImage:
    """PDF中的图片信息"""
    id: str
    page_num: int  # 页码（从1开始）
    x0: float  # 左边界
    y0: float  # 下边界
    x1: float  # 右边界
    y1: float  # 上边界
    width: float
    height: float
    image_path: Optional[str] = None  # 保存的图片路径
    image_base64: Optional[str] = None  # base64编码（可选）
    format: str = "png"


@dataclass
class PDFTextBlock:
    """PDF文本块"""
    id: str
    page_num: int
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    font_size: Optional[float] = None
    is_title: bool = False


@dataclass
class PDFPage:
    """PDF页面内容"""
    page_num: int
    width: float
    height: float
    text_blocks: List[PDFTextBlock]
    images: List[PDFImage]
    raw_text: str


@dataclass
class PDFExtractResult:
    """PDF提取结果"""
    file_path: str
    total_pages: int
    pages: List[PDFPage]
    metadata: Dict[str, Any]
    extracted_at: str

    def to_dict(self) -> Dict:
        """转换为字典（用于JSON序列化）"""
        return {
            "file_path": self.file_path,
            "total_pages": self.total_pages,
            "pages": [
                {
                    "page_num": p.page_num,
                    "width": p.width,
                    "height": p.height,
                    "text_blocks": [asdict(tb) for tb in p.text_blocks],
                    "images": [asdict(img) for img in p.images],
                    "raw_text": p.raw_text
                }
                for p in self.pages
            ],
            "metadata": self.metadata,
            "extracted_at": self.extracted_at
        }


class PDFWithImagesExtractor:
    """PDF文本+图片提取器"""

    def __init__(self):
        if not PDFPLUMBER_AVAILABLE:
            raise ImportError("需要 pdfplumber: pip install pdfplumber")

    def extract(
        self,
        pdf_path: str,
        output_dir: Optional[str] = None,
        save_images: bool = True,
        image_format: str = "png",
        base64_images: bool = False,
        start_page: int = 0,
        end_page: Optional[int] = None,
        include_raw_text: bool = True,
        skip_garbage: bool = True,
        min_image_width: int = 30,
        min_image_height: int = 30,
        verbose: bool = True
    ) -> PDFExtractResult:
        """
        提取PDF文本和图片

        Args:
            pdf_path: PDF文件路径
            output_dir: 输出目录（用于保存图片）
            save_images: 是否保存图片到文件
            image_format: 图片格式 (png, jpg, jpeg)
            base64_images: 是否将图片编码为base64（会增加JSON大小）
            start_page: 起始页（0索引）
            end_page: 结束页（不含）
            include_raw_text: 是否包含原始文本
            skip_garbage: 是否过滤垃圾内容（页码、页眉页脚等）
            min_image_width: 最小图片宽度（跳过更小的装饰性图片）
            min_image_height: 最小图片高度
            verbose: 是否打印详细日志

        Returns:
            PDFExtractResult - 结构化的提取结果
        """
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF文件不存在: {pdf_path}")

        # 验证图片格式
        valid_formats = ["png", "jpg", "jpeg"]
        if image_format.lower() not in valid_formats:
            image_format = "png"

        # 准备输出目录
        images_dir = None
        if output_dir:
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            if save_images:
                images_dir = output_path / "images"
                images_dir.mkdir(exist_ok=True)

        pages_data = []

        with pdfplumber.open(str(pdf_path)) as pdf:
            total_pages = len(pdf.pages)
            actual_end = end_page if end_page is not None else total_pages

            if verbose:
                print(f"[PDF] 开始提取: {pdf_path.name}")
                print(f"[PDF] 总页数: {total_pages}, 提取范围: {start_page + 1}-{actual_end}")

            for page_idx in range(start_page, actual_end):
                page = pdf.pages[page_idx]
                page_num = page_idx + 1

                if verbose:
                    print(f"[PDF] 处理第 {page_num}/{total_pages} 页...")

                # 提取文本块
                text_blocks = self._extract_text_blocks(
                    page, page_num, skip_garbage, verbose=verbose
                )

                # 提取图片
                images = self._extract_images(
                    page, page_num,
                    save_images=save_images,
                    images_dir=images_dir,
                    image_format=image_format,
                    base64_images=base64_images,
                    pdf_name=pdf_path.stem,
                    min_width=min_image_width,
                    min_height=min_image_height,
                    verbose=verbose
                )

                # 原始文本
                raw_text = page.extract_text() if include_raw_text else ""

                # 创建页面对象
                page_data = PDFPage(
                    page_num=page_num,
                    width=page.width,
                    height=page.height,
                    text_blocks=text_blocks,
                    images=images,
                    raw_text=raw_text
                )
                pages_data.append(page_data)

        # 构建结果
        result = PDFExtractResult(
            file_path=str(pdf_path),
            total_pages=total_pages,
            pages=pages_data,
            metadata={
                "filename": pdf_path.name,
                "file_size": pdf_path.stat().st_size,
                "image_count": sum(len(p.images) for p in pages_data),
                "text_block_count": sum(len(p.text_blocks) for p in pages_data),
                "image_format": image_format,
                "has_base64_images": base64_images
            },
            extracted_at=datetime.now().isoformat()
        )

        if verbose:
            print(f"\n[PDF] 提取完成!")
            print(f"[PDF]   - 页面数: {len(pages_data)}")
            print(f"[PDF]   - 文本块: {result.metadata['text_block_count']}")
            print(f"[PDF]   - 图片数: {result.metadata['image_count']}")

        return result

    def _extract_text_blocks(
        self,
        page,
        page_num: int,
        skip_garbage: bool,
        verbose: bool = False
    ) -> List[PDFTextBlock]:
        """提取文本块"""
        text_blocks = []
        block_id = 0

        try:
            # 获取页面上的单词
            words = page.extract_words(extra_attrs=["size"])

            if not words:
                return text_blocks

            # 按行分组
            lines_dict = defaultdict(list)
            for word in words:
                y_key = round(word["bottom"] / 3) * 3
                lines_dict[y_key].append(word)

            # 处理每一行
            for y in sorted(lines_dict.keys()):
                line_words = sorted(lines_dict[y], key=lambda w: w["x0"])

                if not line_words:
                    continue

                # 构建文本
                line_text = " ".join(w["text"] for w in line_words)

                # 过滤垃圾内容
                if skip_garbage and self._is_garbage_line(line_text):
                    continue

                # 获取边界
                x0 = min(w["x0"] for w in line_words)
                x1 = max(w["x1"] for w in line_words)
                y0 = min(w["top"] for w in line_words)
                y1 = max(w["bottom"] for w in line_words)

                # 字体大小（取第一个单词的）
                font_size = line_words[0].get("size")

                # 判断是否是标题（字体较大）
                is_title = font_size and font_size > 14

                text_block = PDFTextBlock(
                    id=f"tb-{page_num}-{block_id}",
                    page_num=page_num,
                    x0=x0,
                    y0=y0,
                    x1=x1,
                    y1=y1,
                    text=line_text,
                    font_size=font_size,
                    is_title=is_title
                )
                text_blocks.append(text_block)
                block_id += 1

        except Exception as e:
            if verbose:
                print(f"  [Warn] 第 {page_num} 页文本提取出错: {e}")

        return text_blocks

    def _extract_images(
        self,
        page,
        page_num: int,
        save_images: bool,
        images_dir: Optional[Path],
        image_format: str,
        base64_images: bool,
        pdf_name: str,
        min_width: int,
        min_height: int,
        verbose: bool = False
    ) -> List[PDFImage]:
        """提取图片 - 改进版本"""
        images = []
        img_id = 0

        try:
            # 获取页面上的图片
            page_images = page.images

            if not page_images and verbose:
                print(f"  [Info] 第 {page_num} 页没有找到图片")

            for img in page_images:
                # 计算尺寸
                width = img["x1"] - img["x0"]
                height = img["y1"] - img["y0"]

                # 跳过太小的图片（可能是装饰性元素）
                if width < min_width or height < min_height:
                    continue

                pdf_image = PDFImage(
                    id=f"img-{page_num}-{img_id}",
                    page_num=page_num,
                    x0=float(img["x0"]),
                    y0=float(img["top"]),
                    x1=float(img["x1"]),
                    y1=float(img["bottom"]),
                    width=float(width),
                    height=float(height),
                    format=image_format
                )

                # 保存图片
                if save_images and images_dir:
                    try:
                        # 方法1: 尝试直接获取图片对象
                        saved = False
                        if hasattr(page, 'to_image'):
                            try:
                                # 使用裁剪方式提取图片区域
                                bbox = (img["x0"], img["top"], img["x1"], img["bottom"])
                                cropped = page.within_bbox(bbox)
                                if cropped:
                                    page_image = cropped.to_image()
                                    if page_image:
                                        # 保存
                                        img_filename = f"{pdf_name}_page{page_num}_img{img_id}.{image_format}"
                                        img_path = images_dir / img_filename
                                        page_image.save(str(img_path))
                                        pdf_image.image_path = str(img_path)
                                        saved = True

                                        if verbose:
                                            print(f"  [Image] 保存: {img_filename} ({width:.0f}x{height:.0f})")
                            except Exception as e:
                                if verbose:
                                    print(f"  [Debug] 裁剪方式失败: {e}")

                        # 如果方法1失败，尝试其他方式...
                        # (pdfplumber提取内嵌图片比较复杂，这里主要提供坐标信息)

                    except Exception as e:
                        if verbose:
                            print(f"  [Warn] 图片保存失败 (img-{page_num}-{img_id}): {e}")

                # Base64编码（可选）
                if base64_images and images_dir and pdf_image.image_path:
                    try:
                        img_path = Path(pdf_image.image_path)
                        if img_path.exists():
                            with open(img_path, "rb") as f:
                                img_data = f.read()
                                pdf_image.image_base64 = base64.b64encode(img_data).decode('utf-8')
                    except Exception as e:
                        if verbose:
                            print(f"  [Warn] Base64编码失败: {e}")

                images.append(pdf_image)
                img_id += 1

        except Exception as e:
            if verbose:
                print(f"  [Warn] 第 {page_num} 页图片提取出错: {e}")

        return images

    def _is_garbage_line(self, text: str) -> bool:
        """判断是否是垃圾内容行"""
        if not text or not text.strip():
            return True

        text_stripped = text.strip()

        # 太短的行可能是页码
        if len(text_stripped) < 5:
            if re.match(r'^\d+$', text_stripped):
                return True
            if re.match(r'^[Pp]age\s*\d+$', text_stripped):
                return True
            if re.match(r'^-\s*\d+\s*-$', text_stripped):
                return True
            return False

        # 垃圾关键词
        garbage_keywords = [
            '版权所有', '未经授权', '翻印必究', '版板所有',
            'ISBN', 'ISSN', '定价', '价格', '价 ¥', '¥',
            '出版社', '发行', '经销', '印刷',
            '地址', '邮编', '邮政编码', '邮发代号',
            '电话', '传真', '网址', 'E-mail', 'Email', '网页',
            '版次', '印次', '印数', '印张', '字数', '开本',
            '前言', '编写说明', '编写目的', '出版说明', '说明',
            '目录', 'Contents', '目 录', 'CONTENTS', '目录页',
            '参考文献', '参考文献列表', '参考书目', '索引',
            '附表', '附录', '附图',
            '页眉', '页脚', '上接', '下转', '续表',
            'CIP', 'CIP数据', 'CIP核字',
        ]

        for kw in garbage_keywords:
            if kw in text_stripped:
                return True

        # 检查版权符号
        if re.search(r'©|®|™|§', text_stripped):
            return True

        # 检查邮箱或网址
        if re.search(r'[\w.-]+@[\w.-]+\.\w+|https?://|www\.', text_stripped):
            return True

        return False

    def save_json(self, result: PDFExtractResult, output_path: str):
        """保存结果为JSON文件"""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result.to_dict(), f, ensure_ascii=False, indent=2)

        print(f"[PDF] 结果已保存: {output_path}")

    def get_content_near_image(
        self,
        result: PDFExtractResult,
        image_id: str,
        max_distance: float = 100
    ) -> Dict[str, List[PDFTextBlock]]:
        """
        获取图片附近的文本内容

        Args:
            result: 提取结果
            image_id: 图片ID
            max_distance: 最大搜索距离（像素）

        Returns:
            包含上方、下方、左侧、右侧文本的字典
        """
        # 找到图片
        target_image = None
        target_page = None

        for page in result.pages:
            for img in page.images:
                if img.id == image_id:
                    target_image = img
                    target_page = page
                    break
            if target_image:
                break

        if not target_image or not target_page:
            return {"above": [], "below": [], "left": [], "right": []}

        above = []
        below = []
        left = []
        right = []

        for block in target_page.text_blocks:
            # 计算垂直距离
            vertical_dist = min(
                abs(block.y1 - target_image.y0),  # 文本底部到图片顶部
                abs(block.y0 - target_image.y1)   # 文本顶部到图片底部
            )

            # 计算水平距离
            horizontal_dist = min(
                abs(block.x1 - target_image.x0),  # 文本右边到图片左边
                abs(block.x0 - target_image.x1)   # 文本左边到图片右边
            )

            # 判断位置关系
            if vertical_dist < max_distance:
                # 垂直方向
                if block.y1 < target_image.y0:
                    above.append(block)
                elif block.y0 > target_image.y1:
                    below.append(block)

            if horizontal_dist < max_distance:
                # 水平方向
                if block.x1 < target_image.x0:
                    left.append(block)
                elif block.x0 > target_image.x1:
                    right.append(block)

        return {
            "above": sorted(above, key=lambda b: -b.y1),  # 从上到下（最近的在前）
            "below": sorted(below, key=lambda b: b.y0),    # 从下到上（最近的在前）
            "left": sorted(left, key=lambda b: -b.x1),
            "right": sorted(right, key=lambda b: b.x0)
        }

    def get_all_images_with_context(
        self,
        result: PDFExtractResult,
        max_distance: float = 150
    ) -> List[Dict]:
        """
        获取所有图片及其上下文文本

        Args:
            result: 提取结果
            max_distance: 搜索上下文的最大距离

        Returns:
            包含图片信息和上下文的列表
        """
        images_with_context = []

        for page in result.pages:
            for img in page.images:
                context = self.get_content_near_image(result, img.id, max_distance)
                images_with_context.append({
                    "image": img,
                    "page_num": page.page_num,
                    "context_above": [tb.text for tb in context["above"]],
                    "context_below": [tb.text for tb in context["below"]],
                    "context_left": [tb.text for tb in context["left"]],
                    "context_right": [tb.text for tb in context["right"]]
                })

        return images_with_context


# ========== 简单使用示例 ==========
def simple_extract(pdf_path: str, output_dir: str = "pdf_output", verbose: bool = True):
    """简单提取PDF的文本和图片"""
    extractor = PDFWithImagesExtractor()

    result = extractor.extract(
        pdf_path=pdf_path,
        output_dir=output_dir,
        save_images=True,
        image_format="png",
        base64_images=False,
        skip_garbage=True,
        verbose=verbose
    )

    # 保存JSON
    json_path = Path(output_dir) / f"{Path(pdf_path).stem}_extracted.json"
    extractor.save_json(result, str(json_path))

    return result


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("=" * 60)
        print("PDF 文本+图片提取工具")
        print("=" * 60)
        print("\n用法:")
        print("  python pdf_with_images_extractor.py <pdf文件路径> [输出目录]")
        print("\n示例:")
        print("  python pdf_with_images_extractor.py 我的书.pdf")
        print("  python pdf_with_images_extractor.py 我的书.pdf output_dir")
        print("\n输出:")
        print("  输出目录/")
        print("    ├── images/          (提取的图片)")
        print("    └── 文件名_extracted.json (结构化数据)")
        print("=" * 60)
        sys.exit(1)

    pdf_file = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "pdf_output"

    simple_extract(pdf_file, output_dir)
