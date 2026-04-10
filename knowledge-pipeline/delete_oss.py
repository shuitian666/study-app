# -*- coding: utf-8 -*-
"""删除 OSS 上的问题知识库"""

import sys
sys.path.insert(0, '.')

from config import OSS_CONFIG
import oss2

auth = oss2.Auth(OSS_CONFIG['access_key_id'], OSS_CONFIG['access_key_secret'])
endpoint = OSS_CONFIG['region'] + '.aliyuncs.com'
bucket = oss2.Bucket(auth, endpoint, OSS_CONFIG['bucket'])

print(f"Connected to bucket: {OSS_CONFIG['bucket']} at {endpoint}")

# 删除有问题的文件
files_to_delete = [
    'knowledge/microbiology/index.json',
    'knowledge/microbiology/knowledge.json'
]

for f in files_to_delete:
    try:
        result = bucket.delete_object(f)
        print(f'Deleted: {f}, status: {result.status}')
    except oss2.exceptions.NoSuchKey:
        print(f'Not found (already deleted): {f}')
    except Exception as e:
        print(f'Failed to delete {f}: {e}')

print('Done!')
