# -*- coding: utf-8 -*-
"""
知识抽取工具 - 从电子书籍中提取知识点
支持 PDF、TXT、EPUB 等格式
"""

import os
import re
import json
import argparse
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from pathlib import Path

# PDF 提取
try:
    import pdfplumber
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    print("警告: pdfplumber 未安装，PDF 支持受限。请运行: pip install pdfplumber")

try:
    from PyPDF2 import PdfReader
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False

# 中文分词和NLP
try:
    import jieba
    import jieba.analyse
    JIEBA_AVAILABLE = True
except ImportError:
    JIEBA_AVAILABLE = False
    print("警告: jieba 未安装。请运行: pip install jieba")

try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False


class KnowledgeExtractor:
    """知识点抽取器"""

    def __init__(self):
        self.knowledge_points = []
        self.subject = "通用"
        self.chapter = "自动识别"
        self.subject_id = "general"
        self.chapter_id = "auto"
        
        # 知识点模式定义
        self.patterns = {
            # 定义类模式
            'definition': [
                r'是\s*指\s*(.+)',
                r'称为\s*(.+)',
                r'定义为\s*(.+)',
                r'指的是\s*(.+)',
                r'即\s*(.+)',
            ],
            # 概念类模式
            'concept': [
                r'概念[：:]\s*(.+?)(?=\n|$)',
                r'定义[：:]\s*(.+?)(?=\n|$)',
                r'含义[：:]\s*(.+?)(?=\n|$)',
            ],
            # 公式类模式
            'formula': [
                r'公式[：:]\s*([A-Za-z0-9\+\-\*\/\^\(\)=]+)',
                r'([A-Za-z0-9]+)\s*=\s*([A-Za-z0-9\+\-\*\/\^\(\)\.]+)',
            ],
            # 特征/特点类
            'feature': [
                r'特点[：:]\s*(.+?)(?=\n|。|$)',
                r'特征[：:]\s*(.+?)(?=\n|。|$)',
                r'特性[：:]\s*(.+?)(?=\n|。|$)',
            ],
            # 分类类
            'category': [
                r'分类[：:]\s*(.+?)(?=\n|。|$)',
                r'类型[：:]\s*(.+?)(?=\n|。|$)',
                r'包括[：:]\s*(.+?)(?=\n|。|$)',
            ],
            # 方法/步骤类
            'method': [
                r'方法[：:]\s*(.+?)(?=\n|。|$)',
                r'步骤[：:]\s*(.+?)(?=\n|。|$)',
                r'原则[：:]\s*(.+?)(?=\n|。|$)',
            ],
        }

    def extract_from_pdf(self, file_path: str) -> str:
        """从PDF文件提取文本"""
        text = ""
        
        try:
            if PDF_AVAILABLE:
                with pdfplumber.open(file_path) as pdf:
                    print(f"  正在处理 {len(pdf.pages)} 页...")
                    for i, page in enumerate(pdf.pages):
                        page_text = page.extract_text()
                        if page_text:
                            text += f"\n--- 第 {i+1} 页 ---\n"
                            text += page_text
            elif PYPDF2_AVAILABLE:
                reader = PdfReader(file_path)
                print(f"  正在处理 {len(reader.pages)} 页...")
                for i, page in enumerate(reader.pages):
                    page_text = page.extract_text()
                    if page_text:
                        text += f"\n--- 第 {i+1} 页 ---\n"
                        text += page_text
            else:
                raise Exception("无可用的PDF解析库")
                
        except Exception as e:
            print(f"  PDF解析错误: {e}")
            return ""
            
        return text

    def extract_from_txt(self, file_path: str) -> str:
        """从TXT文件提取文本"""
        encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030']
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        
        # 尝试忽略错误读取
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()

    def extract_from_epub(self, file_path: str) -> str:
        """从EPUB文件提取文本（简化实现）"""
        try:
            import zipfile
            from xml.etree import ElementTree as ET
            
            text = ""
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                for file in zip_ref.namelist():
                    if file.endswith('.xhtml') or file.endswith('.html') or file.endswith('.htm'):
                        try:
                            content = zip_ref.read(file).decode('utf-8', errors='ignore')
                            # 简单去除HTML标签
                            content = re.sub(r'<[^>]+>', ' ', content)
                            content = re.sub(r'\s+', ' ', content)
                            text += content + "\n"
                        except:
                            continue
            return text
        except Exception as e:
            print(f"  EPUB解析错误: {e}")
            return ""

    def extract_text(self, file_path: str) -> str:
        """根据文件类型提取文本"""
        ext = Path(file_path).suffix.lower()
        
        print(f"正在提取文本...")
        
        if ext == '.pdf':
            return self.extract_from_pdf(file_path)
        elif ext == '.txt':
            return self.extract_from_txt(file_path)
        elif ext == '.epub':
            return self.extract_from_epub(file_path)
        else:
            # 尝试作为文本文件读取
            return self.extract_from_txt(file_path)

    def split_into_sections(self, text: str) -> List[str]:
        """将文本分割成段落/章节"""
        # 去除多余空白
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # 按行分割并过滤空行
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        # 合并短段落
        sections = []
        current = ""
        min_length = 50  # 最小段落长度
        
        for line in lines:
            # 检测是否为标题（短行+特定格式）
            is_title = (
                len(line) < 50 and 
                (line.startswith('#') or 
                 re.match(r'^(第[一二三四五六七八九十]+[章节部]|[0-9]+[.、])', line) or
                 re.match(r'^[A-Z][.、]', line))
            )
            
            if is_title and current:
                if len(current) >= min_length:
                    sections.append(current)
                current = line
            else:
                current += " " + line if current else line
                
        if current and len(current) >= min_length:
            sections.append(current)
            
        return sections

    def extract_knowledge_from_text(self, text: str) -> List[Dict]:
        """从文本中提取知识点"""
        knowledge_points = []
        
        sections = self.split_into_sections(text)
        
        for i, section in enumerate(sections):
            # 尝试提取标题和内容
            title_match = re.match(r'^([^\n]{5,40})', section)
            title = title_match.group(1) if title_match else f"知识点_{i+1}"
            
            # 清理标题
            title = re.sub(r'^#+\s*', '', title)
            title = re.sub(r'^[0-9]+[.、]\s*', '', title)
            title = re.sub(r'^(第[一二三四五六七八九十]+[章节部])\s*', '', title)
            
            # 提取关键句子作为解释
            sentences = re.split(r'[。！？；\n]', section)
            key_sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
            
            if key_sentences:
                explanation = '。'.join(key_sentences[:3])  # 取前3个关键句子
                
                #尝试提取关键词
                keywords = []
                if JIEBA_AVAILABLE:
                    try:
                        keywords = jieba.analyse.extract_tags(explanation, topK=5)
                    except:
                        pass
                
                kp = {
                    'id': f'kp-extract-{datetime.now().strftime("%Y%m%d%H%M%S")}-{i+1}',
                    'subjectId': self.subject_id,
                    'chapterId': self.chapter_id,
                    'name': title,
                    'explanation': explanation,
                    'proficiency': 'none',
                    'lastReviewedAt': None,
                    'nextReviewAt': datetime.now().isoformat(),
                    'reviewCount': 0,
                    'createdAt': datetime.now().isoformat(),
                    'source': 'import',
                    'keywords': keywords,
                    'raw_text': section[:200] if len(section) > 200 else section,  # 保留原文用于参考
                }
                
                knowledge_points.append(kp)
        
        return knowledge_points

    def extract_with_patterns(self, text: str) -> List[Dict]:
        """使用预定义模式提取知识点"""
        knowledge_points = []
        kp_id = int(datetime.now().timestamp())
        
        for pattern_type, patterns in self.patterns.items():
            for pattern in patterns:
                matches = re.finditer(pattern, text, re.MULTILINE)
                for match in matches:
                    content = match.group(1) if match.lastindex else match.group(0)
                    
                    # 获取上下文
                    start = max(0, match.start() - 100)
                    end = min(len(text), match.end() + 100)
                    context = text[start:end].replace('\n', ' ')
                    
                    # 提取标题
                    title = content[:30] if len(content) > 30 else content
                    
                    kp = {
                        'id': f'kp-pattern-{kp_id}',
                        'subjectId': self.subject_id,
                        'chapterId': self.chapter_id,
                        'name': title,
                        'explanation': f"{content}。\n\n【上下文】{context}",
                        'proficiency': 'none',
                        'lastReviewedAt': None,
                        'nextReviewAt': datetime.now().isoformat(),
                        'reviewCount': 0,
                        'createdAt': datetime.now().isoformat(),
                        'source': 'import',
                        'pattern_type': pattern_type,
                    }
                    knowledge_points.append(kp)
                    kp_id += 1
                    
        return knowledge_points

    def process_file(self, file_path: str, subject: str = "通用", 
                     subject_id: str = "general", chapter: str = "自动识别",
                     chapter_id: str = "auto", use_ai: bool = False) -> List[Dict]:
        """处理单个文件"""
        print(f"\n处理文件: {file_path}")
        
        self.subject = subject
        self.subject_id = subject_id
        self.chapter = chapter
        self.chapter_id = chapter_id
        
        # 提取文本
        text = self.extract_text(file_path)
        
        if not text:
            print("  未能提取文本内容")
            return []
        
        print(f"  提取文本长度: {len(text)} 字符")
        
        # 提取知识点
        if use_ai and (JIEBA_AVAILABLE or SPACY_AVAILABLE):
            # 使用NLP增强提取
            knowledge_points = self.extract_knowledge_from_text(text)
            pattern_points = self.extract_with_patterns(text)
            # 合并并去重
            all_points = knowledge_points + pattern_points
        else:
            # 基础提取
            knowledge_points = self.extract_knowledge_from_text(text)
            pattern_points = self.extract_with_patterns(text)
            all_points = knowledge_points + pattern_points
        
        print(f"  提取到 {len(all_points)} 个知识点")
        
        return all_points

    def process_directory(self, dir_path: str, subject: str = "通用",
                         subject_id: str = "general") -> List[Dict]:
        """处理整个目录"""
        all_points = []
        dir_path = Path(dir_path)
        
        supported_extensions = ['.pdf', '.txt', '.epub', '.md', '.html', '.xhtml']
        
        for ext in supported_extensions:
            for file_path in dir_path.rglob(f'*{ext}'):
                chapter = file_path.stem  # 使用文件名作为章节
                chapter_id = f"{subject_id}-{file_path.stem}"
                
                points = self.process_file(
                    str(file_path), 
                    subject=subject,
                    subject_id=subject_id,
                    chapter=chapter,
                    chapter_id=chapter_id
                )
                all_points.extend(points)
                
        return all_points

    def export_to_json(self, knowledge_points: List[Dict], output_path: str):
        """导出为JSON格式（可导入知识库）"""
        export_data = {
            'version': '1.0',
            'exportTime': datetime.now().isoformat(),
            'knowledgePoints': knowledge_points,
            'metadata': {
                'total': len(knowledge_points),
                'subject': self.subject,
                'subjectId': self.subject_id,
            }
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
            
        print(f"\n已导出 {len(knowledge_points)} 个知识点到: {output_path}")

    def export_to_csv(self, knowledge_points: List[Dict], output_path: str):
        """导出为CSV格式"""
        import csv
        
        headers = ['id', 'subjectId', 'chapterId', 'name', 'explanation', 'proficiency', 'createdAt']
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(knowledge_points)
            
        print(f"\n已导出 {len(knowledge_points)} 个知识点到: {output_path}")

    def export_to_localstorage(self, knowledge_points: List[Dict], output_path: str):
        """导出为可直接复制到localStorage的格式"""
        js_content = '''// 知识库导入数据
// 生成时间: {time}
// 知识点数量: {count}

const IMPORT_DATA = {data};

// 使用方法:
// 1. 打开浏览器开发者工具 (F12)
// 2. 在Console中执行:
//    localStorage.setItem('smart_study_knowledge', JSON.stringify([...JSON.parse(localStorage.getItem('smart_study_knowledge') || '[]'), ...IMPORT_DATA.knowledgePoints]));

// 或者使用以下函数:
function importKnowledge() {{
    const existing = JSON.parse(localStorage.getItem('smart_study_knowledge') || '[]');
    const newData = IMPORT_DATA.knowledgePoints;
    const merged = [...existing, ...newData];
    localStorage.setItem('smart_study_knowledge', JSON.stringify(merged));
    console.log('已导入 {count} 个知识点');
    return merged.length;
}}

// 执行导入:
importKnowledge();
'''.format(
            time=datetime.now().isoformat(),
            count=len(knowledge_points),
            data=json.dumps({'knowledgePoints': knowledge_points}, ensure_ascii=False, indent=2)
        )
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(js_content)
            
        print(f"\n已导出导入脚本到: {output_path}")
        print("  复制脚本内容到浏览器控制台执行即可导入")


def generate_sample_questions(knowledge_point: Dict) -> List[Dict]:
    """为知识点生成示例题目（基于规则）"""
    questions = []
    name = knowledge_point.get('name', '')
    explanation = knowledge_point.get('explanation', '')
    
    # 生成简答题
    if len(explanation) > 50:
        question = {
            'id': f"q-{knowledge_point['id']}-1",
            'knowledgePointId': knowledge_point['id'],
            'subjectId': knowledge_point['subjectId'],
            'type': 'short_answer',
            'stem': f"请解释什么是{name}？",
            'answer': explanation[:500],
            'explanation': f"参考答案: {explanation}",
        }
        questions.append(question)
    
    return questions


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='知识抽取工具 - 从电子书籍提取知识点')
    parser.add_argument('input', help='输入文件或目录路径')
    parser.add_argument('-o', '--output', default='knowledge_export.json', help='输出文件路径')
    parser.add_argument('-s', '--subject', default='通用', help='学科名称')
    parser.add_argument('--subject-id', default='general', help='学科ID')
    parser.add_argument('-c', '--chapter', default='自动识别', help='章节名称')
    parser.add_argument('--chapter-id', default='auto', help='章节ID')
    parser.add_argument('--format', choices=['json', 'csv', 'js'], default='json', help='输出格式')
    parser.add_argument('--use-ai', action='store_true', help='使用AI增强提取（需要安装jieba/spacy）')
    parser.add_argument('--generate-questions', action='store_true', help='同时生成题目')
    
    args = parser.parse_args()
    
    print("=" * 50)
    print("📚 知识抽取工具")
    print("=" * 50)
    
    # 检查依赖
    print("\n依赖检查:")
    print(f"  pdfplumber: {'✓' if PDF_AVAILABLE else '✗'}")
    print(f"  PyPDF2: {'✓' if PYPDF2_AVAILABLE else '✗'}")
    print(f"  jieba: {'✓' if JIEBA_AVAILABLE else '✗'}")
    print(f"  spacy: {'✓' if SPACY_AVAILABLE else '✗'}")
    
    extractor = KnowledgeExtractor()
    
    input_path = Path(args.input)
    
    if input_path.is_file():
        knowledge_points = extractor.process_file(
            str(input_path),
            subject=args.subject,
            subject_id=args.subject_id,
            chapter=args.chapter,
            chapter_id=args.chapter_id,
            use_ai=args.use_ai
        )
    elif input_path.is_dir():
        knowledge_points = extractor.process_directory(
            str(input_path),
            subject=args.subject,
            subject_id=args.subject_id
        )
    else:
        print(f"错误: 路径不存在 - {args.input}")
        return
    
    if not knowledge_points:
        print("\n未提取到任何知识点")
        return
    
    # 生成题目
    if args.generate_questions:
        all_questions = []
        for kp in knowledge_points:
            questions = generate_sample_questions(kp)
            all_questions.extend(questions)
        
        # 保存题目
        questions_output = args.output.replace('.json', '_questions.json')
        questions_output = questions_output.replace('.csv', '_questions.json')
        questions_output = questions_output.replace('.js', '_questions.js')
        
        with open(questions_output, 'w', encoding='utf-8') as f:
            json.dump({
                'questions': all_questions,
                'version': '1.0',
                'exportTime': datetime.now().isoformat(),
            }, f, ensure_ascii=False, indent=2)
        print(f"\n已生成 {len(all_questions)} 道题目到: {questions_output}")
    
    # 导出
    if args.format == 'json':
        extractor.export_to_json(knowledge_points, args.output)
    elif args.format == 'csv':
        extractor.export_to_csv(knowledge_points, args.output)
    elif args.format == 'js':
        extractor.export_to_localstorage(knowledge_points, args.output)
    
    print("\n" + "=" * 50)
    print("✅ 处理完成!")
    print("=" * 50)
    
    # 显示预览
    print("\n知识点预览 (前3个):")
    for i, kp in enumerate(knowledge_points[:3]):
        print(f"\n{i+1}. {kp['name']}")
        print(f"   {kp['explanation'][:100]}...")


if __name__ == '__main__':
    main()
