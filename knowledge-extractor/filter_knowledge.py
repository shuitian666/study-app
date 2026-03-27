# -*- coding: utf-8 -*-
import json

with open(r'C:\Users\35460\study-app\knowledge-extractor\import_20260325_204822.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

kps = data['knowledgePoints']
print(f'Total: {len(kps)} points')

# Filter out metadata/prefix content
skip_patterns = ['全国中医药行业', '加强顶层设计', '精选编写队伍', '突出精品意识', '尝试形式创新', 
                 '前言', '专家指导', '编写说明', '图书在版', '中医药出版社', 'ISBN', '中国中医药',
                 '参编', '副主编', '编 委', '购书热线', '社长热线', '官方微博', '淘宝天猫', '请到']

valid = []
for kp in kps:
    name = kp.get('name', '')
    # Skip obvious metadata
    if any(p in name[:50] for p in skip_patterns):
        continue
    # Skip entries that are too long (likely metadata)
    if len(kp.get('explanation', '')) > 600:
        continue
    # Skip very short entries
    if len(name) < 5:
        continue
    valid.append(kp)

print(f'Valid: {len(valid)} points')
print('\nSample names:')
for kp in valid[:20]:
    name = kp['name'][:45]
    print(f'  - {name}')

# Save valid points
output = {
    'version': '1.0',
    'exportTime': data['exportTime'],
    'knowledgePoints': valid,
    'count': len(valid)
}

with open(r'C:\Users\35460\study-app\knowledge-extractor\valid_knowledge.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f'\nSaved to valid_knowledge.json')
