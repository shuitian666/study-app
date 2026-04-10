# -*- coding: utf-8 -*-
"""
知识审核模块 - 本地审核后上传

功能：
1. 将提取的知识点保存到待审核目录
2. 用户审核后，标记为通过/拒绝
3. 只上传通过审核的知识点
"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from enum import Enum


class ReviewStatus(Enum):
    PENDING = "pending"      # 待审核
    APPROVED = "approved"    # 已通过
    REJECTED = "rejected"    # 已拒绝


class KnowledgeReviewer:
    """知识审核器"""

    def __init__(self, output_dir: Path):
        """
        初始化审核器

        Args:
            output_dir: 输出目录（包含 pending, approved, rejected 子目录）
        """
        self.output_dir = Path(output_dir)
        self.pending_dir = self.output_dir / "pending"
        self.approved_dir = self.output_dir / "approved"
        self.rejected_dir = self.output_dir / "rejected"

        # 创建目录
        for d in [self.pending_dir, self.approved_dir, self.rejected_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def save_for_review(self, knowledge_points: List[Dict], subject_name: str,
                       metadata: Dict = None) -> str:
        """
        保存知识点到待审核目录

        Args:
            knowledge_points: 知识点列表
            subject_name: 学科名称（用于文件名）
            metadata: 附加元数据

        Returns:
            保存的文件路径
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{subject_name}_{timestamp}.json"
        filepath = self.pending_dir / filename

        review_data = {
            "version": "1.0",
            "createdAt": datetime.now().isoformat(),
            "subjectName": subject_name,
            "status": ReviewStatus.PENDING.value,
            "metadata": metadata or {},
            "stats": {
                "total": len(knowledge_points),
                "approved": 0,
                "rejected": 0,
            },
            "knowledgePoints": knowledge_points,
            # 每个知识点的审核状态
            "itemReviews": {
                kp["id"]: ReviewStatus.PENDING.value
                for kp in knowledge_points
            }
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(review_data, f, ensure_ascii=False, indent=2)

        print(f"  [审核] 已保存 {len(knowledge_points)} 个知识点到待审核目录")
        print(f"  [审核] 文件: {filepath}")
        print(f"  [审核] 请检查文件并决定是否上传")

        return str(filepath)

    def load_review_file(self, filepath: str) -> Optional[Dict]:
        """加载审核文件"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"  [审核] 加载失败: {e}")
            return None

    def approve_item(self, review_file: str, item_id: str) -> bool:
        """批准单个知识点"""
        data = self.load_review_file(review_file)
        if not data:
            return False

        if item_id in data["itemReviews"]:
            data["itemReviews"][item_id] = ReviewStatus.APPROVED.value
            data["stats"]["approved"] += 1
            self._save_review_data(data, review_file)
            print(f"  [审核] 已批准: {item_id}")
            return True
        return False

    def reject_item(self, review_file: str, item_id: str) -> bool:
        """拒绝单个知识点"""
        data = self.load_review_file(review_file)
        if not data:
            return False

        if item_id in data["itemReviews"]:
            data["itemReviews"][item_id] = ReviewStatus.REJECTED.value
            data["stats"]["rejected"] += 1
            self._save_review_data(data, review_file)
            print(f"  [审核] 已拒绝: {item_id}")
            return True
        return False

    def approve_all(self, review_file: str) -> bool:
        """批准所有知识点"""
        data = self.load_review_file(review_file)
        if not data:
            return False

        for item_id in data["itemReviews"]:
            data["itemReviews"][item_id] = ReviewStatus.APPROVED.value
        data["stats"]["approved"] = len(data["knowledgePoints"])
        data["stats"]["rejected"] = 0

        self._save_review_data(data, review_file)
        print(f"  [审核] 已批准全部 {len(data['knowledgePoints'])} 个知识点")
        return True

    def reject_all(self, review_file: str) -> bool:
        """拒绝所有知识点"""
        data = self.load_review_file(review_file)
        if not data:
            return False

        for item_id in data["itemReviews"]:
            data["itemReviews"][item_id] = ReviewStatus.REJECTED.value
        data["stats"]["rejected"] = len(data["knowledgePoints"])
        data["stats"]["approved"] = 0

        self._save_review_data(data, review_file)
        print(f"  [审核] 已拒绝全部 {len(data['knowledgePoints'])} 个知识点")
        return True

    def finalize_review(self, review_file: str) -> Optional[Tuple[List[Dict], List[Dict]]]:
        """
        完成审核，返回通过审核的知识点和题目

        Returns:
            (通过审核的知识点列表, 题目列表)，失败返回 None
        """
        data = self.load_review_file(review_file)
        if not data:
            return None

        # 筛选已批准的知识点
        approved_kps = [
            kp for kp in data["knowledgePoints"]
            if data["itemReviews"].get(kp["id"]) == ReviewStatus.APPROVED.value
        ]

        if len(approved_kps) == 0:
            print("  [审核] 警告: 没有通过审核的知识点")
            return None

        # 获取题目（如果有）
        questions = data.get("questions", [])

        # 更新状态
        data["status"] = ReviewStatus.APPROVED.value
        data["finalizedAt"] = datetime.now().isoformat()

        # 移动到 approved 目录
        filename = Path(review_file).name
        approved_path = self.approved_dir / filename
        self._save_review_data(data, str(approved_path))

        # 删除原文件
        Path(review_file).unlink(missing_ok=True)

        print(f"  [审核] 已生成最终文件: {approved_path}")
        print(f"  [审核] 共 {len(approved_kps)} 个知识点通过审核")
        if questions:
            print(f"  [审核] 包含 {len(questions)} 道题目")

        return (approved_kps, questions)

    def get_pending_files(self) -> List[Path]:
        """获取待审核文件列表"""
        return list(self.pending_dir.glob("*.json"))

    def get_approved_files(self) -> List[Path]:
        """获取已审核通过文件列表"""
        return list(self.approved_dir.glob("*.json"))

    def _save_review_data(self, data: Dict, filepath: str):
        """保存审核数据"""
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


def print_review_help():
    """打印审核帮助信息"""
    print("""
=== 知识审核流程 ===

1. 运行处理命令后，知识点会保存到 pending 目录
2. 检查 pending 目录中的 JSON 文件
3. 使用以下命令进行审核：

   # 批准单个知识点
   python -c "from processors.review import KnowledgeReviewer; r=KnowledgeReviewer('output'); r.approve_item('文件路径', '知识点ID')"

   # 拒绝单个知识点
   python -c "from processors.review import KnowledgeReviewer; r=KnowledgeReviewer('output'); r.reject_item('文件路径', '知识点ID')"

   # 批准全部
   python -c "from processors.review import KnowledgeReviewer; r=KnowledgeReviewer('output'); r.approve_all('文件路径')"

   # 拒绝全部
   python -c "from processors.review import KnowledgeReviewer; r=KnowledgeReviewer('output'); r.reject_all('文件路径')"

   # 完成审核，生成最终文件（只包含通过的）
   python -c "from processors.review import KnowledgeReviewer; r=KnowledgeReviewer('output'); kps=r.finalize_review('文件路径'); print(f'通过审核: {len(kps)}个')"

4. 只有通过审核的文件才会被上传到 OSS
""")


if __name__ == "__main__":
    print_review_help()