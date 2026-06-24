from __future__ import annotations
from .task_model import Task

def task_to_summary(task: Task):
    return {
        "id": task.id,
        "type": task.type,
        "status": task.status,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "finished_at": task.finished_at.isoformat() if task.finished_at else None,
        "output_name": task.output_name,
        "error": task.error,
        "payload": {
            "suggested_tags": task.payload.suggested_tags if task.type == "jd" else [],
            "extracted_data": task.payload.extracted_data if task.type == "jd" else None,
        }
    }