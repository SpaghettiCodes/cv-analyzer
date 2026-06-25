from __future__ import annotations

from .mapper import task_to_summary
from .db import task_collection, pdf_collection
from dataclasses import asdict
from flask_socketio import SocketIO
from .task_model import *
import json
from bson import ObjectId
import pymongo
from celery_app.app import run_resume_task, run_sync_task, run_jd_task

class TaskService:
    def __init__(self, socketio: SocketIO) -> None:
        self._socketio = socketio
        self._collection = task_collection
        self._sockets = set()

    def register_socket(self, ws):
        self._sockets.add(ws)
        try:
            ws.send(json.dumps({
                "type": "snapshot",
                "tasks": [task_to_summary(t) for t in self.list_tasks()]
            }))
        except Exception:
            self._sockets.discard(ws)

    def unregister_socket(self, ws):
        self._sockets.discard(ws)

    def save(self, task: Task) -> None:
        task_collection.replace_one(
            {"id": task.id},
            self._to_doc(task),
            upsert=True,
        )

        self.broadcast_tasks()

    def load(self, task_id: str) -> Task:
        if not task_id or task_id != task_id.strip():
            raise Exception(f"Task not found: {task_id}")

        document = self._collection.find_one({"id": task_id})
        if document is None:
            raise Exception(f"Task not found: {task_id}")
        return self._from_doc(document)
    
    def list_tasks(self) -> list[Task]:
        documents = self._collection.find().sort("created_at", pymongo.DESCENDING)
        return [self._from_doc(document) for document in documents]

    def broadcast_tasks(self) -> None:
        payload = json.dumps({
            "type": "snapshot",
            "tasks": [task_to_summary(t) for t in self.list_tasks()]
        })
        for ws in list(self._sockets):
            try:
                ws.send(payload)
            except Exception:
                self._sockets.discard(ws)

        try:
            summaries = [task_to_summary(task) for task in self.list_tasks()]
            self._socketio.emit('snapshot', summaries, room='task_updates', namespace='/ws')
        except Exception:
            pass

    def create_resume_task(self, resume_id):
        doc = pdf_collection.find_one({"_id": ObjectId(resume_id)})
        filename = doc.get("original_filename") if doc else str(resume_id)

        task = Task.create_resume(
            ResumeTaskPayload(
                resume=str(resume_id)
            )
        )
        task.output_name = filename
        self.save(task)
        self.broadcast_tasks
        run_resume_task.delay(str(task.id), str(resume_id))
        return task

    def create_jd_task(self, file_path, filename):
        task = Task.create_jd(
            JDTaskPayload(
                jd=file_path,
                suggested_tags=[]
            )
        )
        task.output_name = filename
        self.save(task)
        run_jd_task.delay(str(task.id), str(file_path))
        return task

    def create_sync_task(self, new_tags: list[str]):
        task = Task.create_sync(
            SyncPayload(
                new_tags=new_tags
            )
        )
        task.output_name = f"Sync {len(new_tags)} tags"
        self.save(task)
        run_sync_task.delay(str(task.id), new_tags)
        return task

    @staticmethod
    def _from_doc(document: dict) -> Task:
        payload_data = document["payload"]
        task_type = document["type"]
        
        if task_type == "resume":
            payload = ResumeTaskPayload(resume=payload_data["resume"])
        elif task_type == "jd":
            payload = JDTaskPayload(
                jd=payload_data["jd"],
                suggested_tags=payload_data.get("suggested_tags", []),
                extracted_data=payload_data.get("extracted_data")
            )
        elif task_type == "jd_sync":
            payload = SyncPayload(new_tags=payload_data["new_tags"])
        else:
            raise Exception(f"Unknown task type: {task_type}")

        return Task(
            id=document["id"],
            type=task_type,
            status=document["status"],
            created_at=document.get("created_at"),
            payload=payload,
            started_at=document.get("started_at"),
            finished_at=document.get("finished_at"),
            output_name=document.get("output_name"),
            error=document.get("error")
        )

    @staticmethod
    def _to_doc(task: Task) :
        return {
            "id": task.id,
            "type": task.type,
            "status": task.status,
            "created_at": task.created_at,
            "started_at": task.started_at,
            "finished_at": task.finished_at,
            "payload": asdict(task.payload),
            "output_name": task.output_name,
            "error": task.error,
        }
