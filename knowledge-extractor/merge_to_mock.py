# -*- coding: utf-8 -*-
import json
from datetime import datetime

with open(r'C:\Users\35460\study-app\knowledge-extractor\valid_knowledge.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

kps = data['knowledgePoints']
now = datetime.now().isoformat()

lines = []
lines.append('  // ==================== 方剂学 ====================')

for i, kp in enumerate(kps):
    kid = f'fangji-{i+1}'
    name = kp['name'][:50].replace('"', '\\"')
    explanation = kp['explanation'][:300].replace('"', '\\"').replace('\n', ' ')
    
    lines.append('  {')
    lines.append(f'    id: "{kid}", subjectId: "tcm", chapterId: "tcm-c1", name: "{name}",')
    lines.append(f'    explanation: "{explanation}",')
    lines.append(f'    proficiency: "none", lastReviewedAt: null, nextReviewAt: "{now}", reviewCount: 0, createdAt: "{now}",')
    lines.append('    source: "import",')
    lines.append('  },')

output = '\n'.join(lines)

# Save to file
with open(r'C:\Users\35460\study-app\knowledge-extractor\fangji_knowledge.ts', 'w', encoding='utf-8') as f:
    f.write(output)

print(f'Generated {len(kps)} knowledge points')
print('Sample:')
print(output[:2000])
