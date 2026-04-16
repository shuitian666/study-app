# PDF 文本+图片提取工具使用说明

## 概述

这个工具用于从PDF中提取文本和图片，并保持它们的对应关系。专门为知识库建设设计，方便AI进行后续处理。

## 安装依赖

```bash
pip install pdfplumber pillow
```

## 快速开始

### 1. 命令行使用

```bash
cd knowledge-pipeline
python extractors/pdf_with_images_extractor.py 你的文件.pdf 输出目录
```

### 2. Python代码中使用

```python
from extractors.pdf_with_images_extractor import PDFWithImagesExtractor

# 创建提取器
extractor = PDFWithImagesExtractor()

# 提取PDF
result = extractor.extract(
    pdf_path="你的文件.pdf",
    output_dir="output_dir",  # 图片保存目录
    save_images=True,         # 是否保存图片
    image_format="png",       # 图片格式
    skip_garbage=True         # 过滤垃圾内容（页码、页眉等）
)

# 保存结果为JSON
extractor.save_json(result, "output_dir/result.json")

# 获取某张图片附近的文本
nearby_content = extractor.get_content_near_image(
    result,
    image_id="img-1-0",  # 图片ID
    max_distance=100       # 搜索范围（像素）
)
print("图片上方文本:", [t.text for t in nearby_content["above"]])
print("图片下方文本:", [t.text for t in nearby_content["below"]])
```

## 输出结构

### 目录结构

```
输出目录/
├── images/
│   ├── 文件名_page1_img0.png
│   ├── 文件名_page1_img1.png
│   └── ...
└── 文件名_extracted.json
```

### JSON数据结构

```json
{
  "file_path": "你的文件.pdf",
  "total_pages": 10,
  "pages": [
    {
      "page_num": 1,
      "width": 595.0,
      "height": 842.0,
      "text_blocks": [
        {
          "id": "tb-1-0",
          "page_num": 1,
          "x0": 50.0,
          "y0": 100.0,
          "x1": 500.0,
          "y1": 120.0,
          "text": "这是一段文本",
          "font_size": 12.0,
          "is_title": false
        }
      ],
      "images": [
        {
          "id": "img-1-0",
          "page_num": 1,
          "x0": 100.0,
          "y0": 200.0,
          "x1": 300.0,
          "y1": 400.0,
          "width": 200.0,
          "height": 200.0,
          "image_path": "output_dir/images/文件名_page1_img0.png",
          "format": "png"
        }
      ],
      "raw_text": "整页原始文本..."
    }
  ],
  "metadata": {
    "filename": "你的文件.pdf",
    "file_size": 1234567,
    "image_count": 5,
    "text_block_count": 150
  },
  "extracted_at": "2026-04-10T10:00:00"
}
```

## API说明

### PDFWithImagesExtractor.extract()

主要提取函数，参数：

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| pdf_path | str | 必填 | PDF文件路径 |
| output_dir | str\|None | None | 输出目录（保存图片用） |
| save_images | bool | True | 是否保存图片到文件 |
| image_format | str | "png" | 图片格式 (png/jpg) |
| start_page | int | 0 | 起始页（0索引） |
| end_page | int\|None | None | 结束页（不含） |
| include_raw_text | bool | True | 是否包含原始文本 |
| skip_garbage | bool | True | 是否过滤垃圾内容 |

### PDFWithImagesExtractor.get_content_near_image()

获取图片附近的文本，参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| result | PDFExtractResult | 提取结果 |
| image_id | str | 图片ID |
| max_distance | float | 最大搜索距离（像素） |

返回：
```python
{
  "above": [...],  # 图片上方的文本块
  "below": [...],  # 图片下方的文本块
  "left": [...],   # 图片左侧的文本块
  "right": [...]   # 图片右侧的文本块
}
```

## 给其他AI使用的建议

1. **先提取，后分析**：先用这个工具提取PDF，得到JSON和图片
2. **按页处理**：可以逐页遍历 `result.pages`
3. **关联图片和文本**：用 `get_content_near_image()` 获取图片上下文
4. **保留坐标信息**：所有元素都有x0/y0/x1/y1坐标，可以精确定位

## 示例：遍历所有内容

```python
from extractors.pdf_with_images_extractor import PDFWithImagesExtractor

extractor = PDFWithImagesExtractor()
result = extractor.extract("input.pdf", output_dir="output")

for page in result.pages:
    print(f"\n=== 第 {page.page_num} 页 ===")

    # 打印文本块
    for block in page.text_blocks:
        if block.is_title:
            print(f"[标题] {block.text}")
        else:
            print(f"[文本] {block.text}")

    # 打印图片及其上下文
    for img in page.images:
        print(f"\n[图片] {img.id} ({img.width}x{img.height})")
        nearby = extractor.get_content_near_image(result, img.id, max_distance=150)
        if nearby["above"]:
            print(f"  上文: {nearby['above'][-1].text if nearby['above'] else '无'}")
        if nearby["below"]:
            print(f"  下文: {nearby['below'][0].text if nearby['below'] else '无'}")
```
