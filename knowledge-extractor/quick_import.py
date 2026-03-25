# -*- coding: utf-8 -*-
"""
快速导入脚本 - 一键提取并导入
使用方法: python quick_import.py <书籍路径> [学科名]
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime


def get_chinese_name(path: str) -> str:
    """从路径提取中文名称"""
    name = Path(path).stem
    # 清理文件名
    name = name.replace('_', ' ').replace('-', ' ')
    return name


def auto_detect_subject(filename: str) -> tuple:
    """自动检测学科"""
    filename_lower = filename.lower()
    
    subjects = {
        '中药': ('中药学', 'tcm'),
        '中医': ('中医学', 'tcm'),
        '化学': ('化学', 'chem'),
        '物理': ('物理学', 'physics'),
        '数学': ('数学', 'math'),
        '英语': ('英语', 'eng'),
        '编程': ('编程', 'prog'),
        'python': ('Python编程', 'python'),
        'java': ('Java编程', 'java'),
        'js': ('JavaScript', 'javascript'),
        'react': ('React', 'react'),
        '生物': ('生物学', 'biology'),
        '医学': ('医学', 'medicine'),
        '历史': ('历史', 'history'),
        '地理': ('地理', 'geography'),
    }
    
    for keyword, (name, sid) in subjects.items():
        if keyword in filename_lower:
            return name, sid
    
    return '通用', 'general'


def main():
    if len(sys.argv) < 2:
        print("""
📚 快速知识导入工具
====================

用法:
    python quick_import.py <书籍路径> [学科名]

示例:
    python quick_import.py "中药学.pdf"
    python quick_import.py "我的书籍.pdf" "中药学"
    python quick_import.py ./books/
""")
        return

    input_path = sys.argv[1]
    
    if not os.path.exists(input_path):
        print(f"❌ 错误: 文件不存在 - {input_path}")
        return

    # 自动检测学科
    filename = os.path.basename(input_path)
    if len(sys.argv) >= 3:
        subject = sys.argv[2]
        subject_id = subject.lower()[:4]
    else:
        subject, subject_id = auto_detect_subject(filename)

    # 生成输出文件名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"import_{timestamp}.json"

    print(f"""
╔══════════════════════════════════════════════╗
║       📚 知识抽取快速导入工具                 ║
╠══════════════════════════════════════════════╣
║  输入文件: {input_path[:40]:<32}║
║  学科:     {subject:<40}║
║  学科ID:   {subject_id:<40}║
║  输出:     {output_file:<40}║
╚══════════════════════════════════════════════╝
""")

    # 运行主程序
    cmd = [
        sys.executable, 'main.py',
        input_path,
        '--subject', subject,
        '--subject-id', subject_id,
        '--format', 'json',
        '--output', output_file,
    ]

    try:
        result = subprocess.run(cmd, capture_output=False)
        
        if result.returncode == 0 and os.path.exists(output_file):
            # 读取并显示结果
            with open(output_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            count = len(data.get('knowledgePoints', []))
            
            print(f"""
╔══════════════════════════════════════════════╗
║                 ✅ 完成！                    ║
╠══════════════════════════════════════════════╣
║  提取知识点: {count:<40}║
║  输出文件:   {output_file:<40}║
╚══════════════════════════════════════════════╝

导入步骤:
1. 打开智学助手网站
2. 按 F12 打开开发者工具
3. 切换到 Console 标签
4. 执行以下代码:

const newData = {json.dumps(data.get('knowledgePoints', []), ensure_ascii=False)};
const existing = JSON.parse(localStorage.getItem('smart_study_knowledge') || '[]');
const merged = [...existing, ...newData];
localStorage.setItem('smart_study_knowledge', JSON.stringify(merged));
location.reload();

或者:
1. 打开设置页面
2. 找到"知识库导入"功能
3. 上传 {output_file} 文件
""")
        else:
            print("❌ 提取失败，请检查错误信息")
            
    except Exception as e:
        print(f"❌ 错误: {e}")


if __name__ == '__main__':
    main()
