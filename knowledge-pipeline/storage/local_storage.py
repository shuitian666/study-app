# -*- coding: utf-8 -*-
"""
本地存储模块
"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional


class LocalStorage:
    """本地知识库存储"""

    def __init__(self, base_dir: str = None):
        """
        初始化本地存储

        Args:
            base_dir: 基础目录，默认使用 output/
        """
        if base_dir is None:
            # 默认使用项目下的 output 目录
            project_root = Path(__file__).parent.parent.parent.absolute()
            base_dir = project_root / "output"
        else:
            base_dir = Path(base_dir)

        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

        # 初始化 metadata
        self.metadata_file = self.base_dir / "metadata.json"
        self._init_metadata()

    def _init_metadata(self):
        """初始化元数据文件"""
        if not self.metadata_file.exists():
            metadata = {
                "version": "1.0",
                "createdAt": datetime.now().isoformat(),
                "lastUpdated": datetime.now().isoformat(),
                "subjects": {}
            }
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)

    def _load_metadata(self) -> Dict:
        """加载元数据"""
        with open(self.metadata_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_metadata(self, metadata: Dict):
        """保存元数据"""
        metadata["lastUpdated"] = datetime.now().isoformat()
        with open(self.metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

    def save_knowledge(self, subject_id: str, subject_name: str,
                      knowledge_points: List[Dict], questions: List[Dict] = None) -> str:
        """
        保存知识到本地

        Args:
            subject_id: 学科ID
            subject_name: 学科名称（用于目录）
            knowledge_points: 知识点列表
            questions: 题目列表（可选）

        Returns:
            保存的路径
        """
        # 创建学科目录
        subject_dir = self.base_dir / subject_name
        subject_dir.mkdir(parents=True, exist_ok=True)

        # 保存知识点
        kp_file = subject_dir / "index.json"
        kp_data = {
            "version": "1.0",
            "exportTime": datetime.now().isoformat(),
            "subjectId": subject_id,
            "subjectName": subject_name,
            "total": len(knowledge_points),
            "knowledgePoints": knowledge_points
        }
        with open(kp_file, 'w', encoding='utf-8') as f:
            json.dump(kp_data, f, ensure_ascii=False, indent=2)

        # 保存题目（如果有）
        if questions:
            q_file = subject_dir / "questions.json"
            q_data = {
                "version": "1.0",
                "exportTime": datetime.now().isoformat(),
                "subjectId": subject_id,
                "total": len(questions),
                "questions": questions
            }
            with open(q_file, 'w', encoding='utf-8') as f:
                json.dump(q_data, f, ensure_ascii=False, indent=2)

        # 更新 metadata
        metadata = self._load_metadata()
        metadata["subjects"][subject_id] = {
            "id": subject_id,
            "name": subject_name,
            "dir": str(subject_dir),
            "kpCount": len(knowledge_points),
            "qCount": len(questions) if questions else 0,
            "updatedAt": datetime.now().isoformat()
        }
        self._save_metadata(metadata)

        print(f"  [存储] 已保存到: {subject_dir}")
        return str(subject_dir)

    def load_knowledge(self, subject_name: str) -> Optional[Dict]:
        """
        加载知识

        Args:
            subject_name: 学科名称

        Returns:
            知识数据或 None
        """
        kp_file = self.base_dir / subject_name / "index.json"
        if not kp_file.exists():
            return None

        with open(kp_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def list_subjects(self) -> List[Dict]:
        """列出所有学科"""
        metadata = self._load_metadata()
        return list(metadata.get("subjects", {}).values())

    def get_stats(self) -> Dict:
        """获取统计信息"""
        metadata = self._load_metadata()
        subjects = metadata.get("subjects", {})

        total_kp = sum(s.get("kpCount", 0) for s in subjects.values())
        total_q = sum(s.get("qCount", 0) for s in subjects.values())

        return {
            "totalSubjects": len(subjects),
            "totalKnowledgePoints": total_kp,
            "totalQuestions": total_q,
            "lastUpdated": metadata.get("lastUpdated")
        }
