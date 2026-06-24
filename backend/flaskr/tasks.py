from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path
import gevent
from gevent.queue import Queue
from gevent.event import Event
from .mapper import task_to_summary
from .db import task_collection
from dataclasses import asdict
from flask_socketio import SocketIO
from .ai_client import client, MODEL_NAME
from .prompts import *
from .resume import list_all_tags, _update_pdf_metadata, _extract_text_from_stored_pdf, _extract_text_from_upload, _apply_new_tags_to_resumes
from .task_model import *
import json
from bson import ObjectId
import pymongo
import gevent.threadpool

class TaskService:
    def __init__(self, socketio: SocketIO) -> None:
        self._socketio = socketio
        self._queue = Queue()
        self._worker_task = None
        self._shutdown = Event()
        self._last_reconcile = 0.0
        self._collection = task_collection
        self._sockets = set()
        self._recover_tasks()

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

    def load(self, task_id: str) -> Task:
        if not task_id or task_id != task_id.strip():
            raise Exception(f"Task not found: {task_id}")

        document = self._collection.find_one({"id": task_id})
        if document is None:
            raise Exception(f"Task not found: {task_id}")
        return self._from_doc(document)
    
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

    def list_tasks(self) -> list[Task]:
        documents = self._collection.find().sort("created_at", pymongo.DESCENDING)
        return [self._from_doc(document) for document in documents]

    def list_all(self):
        return self.list_tasks()

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

    def _schedule_broadcast(self) -> None:
        gevent.spawn(self.broadcast_tasks)

    def _enqueue(self, task_id: str) -> None:
        self._queue.put_nowait(task_id)

    def _recover_tasks(self) -> None:
        self._collection.update_many(
            {"status": "running"},
            {"$set": {"status": "pending", "started_at": None}}
        )

    def start_worker(self) -> None:
        if self._worker_task is not None:
            return
        self._shutdown.clear()  
        self._worker_task = gevent.spawn(self._worker_loop)

    def stop_worker(self) -> None:
        self._shutdown.set()
        if self._worker_task is not None:
            self._worker_task.kill(block=True)
            self._worker_task = None

    def _worker_loop(self) -> None:
        try:
            while not self._shutdown.is_set():
                gevent.sleep(0)  # ← yield to hub on every iteration
                print('checking')
                self._reconcile_pending_tasks()
                print("added pending tasks")
                try:
                    task_id = self._queue.get(timeout=1.0)
                    print(f"t: {task_id}")
                except Exception:
                    continue

                if self._shutdown.is_set():
                    break

                try:
                    self._run_task(task_id)
                except Exception:
                    continue
        except Exception as e:
            print(f"WORKER LOOP DIED: {e}")
        finally:
            print("WORKER LOOP EXITED")

    def _reconcile_pending_tasks(self) -> None:
        now = time.time()
        if now - self._last_reconcile < 30.0:
            return
        self._last_reconcile = now

        for task in self.list_tasks():
            gevent.sleep(0)
            if task.status == "pending":
                self._enqueue(task.id)

    def _run_task(self, task_id: str) -> None:
        try:
            task = self.load(task_id)
        except Exception as e:
            print(f"CRITICAL: Failed to load task context for ID {task_id}: {str(e)}")
            return

        if task.status != "pending":
            return

        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        task.error = None
        self.save(task)
        self._schedule_broadcast()

        try:
            if task.type == "resume":
                self._run_resume_task(task)
            elif task.type == "jd":
                self._run_jd_task(task)
            elif task.type == "jd_sync":
                self._run_sync_task(task)
            else:
                raise Exception(f"Unsupported task type {task.type}")

            if task.type != 'jd':
                task.status = "completed"
                task.finished_at = datetime.now(timezone.utc)
            else:
                task.status = 'pending-user-input'
        except Exception as exc:
            task.status = "failed"
            task.error = str(exc)
            task.finished_at = datetime.now(timezone.utc)
        finally:
            self.save(task)
            self._schedule_broadcast()

    def create_resume_task(self, resume_id):
        from .db import pdf_collection
        doc = pdf_collection.find_one({"_id": ObjectId(resume_id)})
        filename = doc.get("original_filename") if doc else str(resume_id)

        task = Task.create_resume(
            ResumeTaskPayload(
                resume=str(resume_id)
            )
        )
        task.output_name = filename
        self.save(task)
        self._enqueue(task.id)
        self._schedule_broadcast()
        return task

    def _run_resume_task(self, task: Task):
        resume_id = task.payload.resume
        pdf_content = _extract_text_from_stored_pdf(resume_id)
        if not pdf_content:
            raise Exception(f"Unable to extract text from resume {resume_id}")
        print('got pdf content')

        print('ai-ing')
        chat_completion = gevent.threadpool.ThreadPool(4).apply(
            client.chat.completions.create,
            kwds={
                'messages': [
                    {
                        "role": "system",
                        "content": (
                            "You are a HR that takes in a resume as text, your job is to match "
                            "which tags best suits the resume. The tags will be passed to you in json form\n"
                            f"The JSON object you return will be in this format:\n{TAGS_JSON}\n"
                            "the return JSON object must have between 1 to 3 _id in an array form ("
                            "you may go over this limit if you feel its suitable, "
                            "do not force assign tags just to have some) "
                            "and only the id, and also the candidate name from the resume\n"
                            f"Here are the tag name, _id and description:\n{list_all_tags()}\n"
                            'if "github" / "name" cant be found remove the field'
                        ),
                    },
                    {
                        "role": "user",
                        "content": "match the tags that fit this resume:\n" + pdf_content,
                    },
                ],
                'model': MODEL_NAME,
                'response_format': {"type": "json_object"},
            }
        )
        print('ai done - extracting value')
        print(type(chat_completion))
        result = json.loads(chat_completion.choices[0].message.content)
        print('ai done')
        _update_pdf_metadata(ObjectId(resume_id), result)
        print('task completed')

    def create_jd_task(self, file_path, filename):
        task = Task.create_jd(
            JDTaskPayload(
                jd=file_path,
                suggested_tags=[]
            )
        )
        task.output_name = filename
        self.save(task)
        self._enqueue(task.id)
        self._schedule_broadcast()
        return task

    def _run_jd_task(self, task: Task):
        file_path = task.payload.jd
        with open(file_path, "rb") as f:
            extract_text = _extract_text_from_upload(f)

        if not extract_text:
            raise Exception("Empty text content extracted from Job Description PDF")

        jd_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional tech recruiter. Extract the info from this job description "
                        f"and structure it exactly into this JSON format. Do not invent anything that isnt stated:\n{JD_PARSED_SCHEMA}"
                    ),
                },
                {"role": "user", "content": extract_text},
            ],
            model=MODEL_NAME,
            response_format={"type": "json_object"},
        )
        jd_data = json.loads(jd_completion.choices[0].message.content)

        if not jd_data.get("mode"): jd_data["mode"] = "Remote"
        if not jd_data.get("type"): jd_data["type"] = "Full Time"

        tag_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Given this job description text, generate a list of 3-5 highly relevant skill or role tags "
                        "(e.g., 'React', 'Python', 'DevOps', 'Agile'). Keep them 1-3 words max, Title Case.\n"
                        f"Return only JSON matching this schema:\n{TAGS_SUGGESTION_SCHEMA}"
                    ),
                },
                {"role": "user", "content": extract_text},
            ],
            model=MODEL_NAME,
            response_format={"type": "json_object"},
        )
        tag_result = json.loads(tag_completion.choices[0].message.content)
        suggested_tags = tag_result.get("tags", [])
        
        task.payload.suggested_tags = suggested_tags
        task.payload.extracted_data = jd_data
        self.save(task)

    def create_sync_task(self, new_tags: list[str]):
        task = Task.create_sync(
            SyncPayload(
                new_tags=new_tags
            )
        )
        task.output_name = f"Sync {len(new_tags)} tags"
        self.save(task)
        self._enqueue(task.id)
        self._schedule_broadcast()
        return task

    def _run_sync_task(self, task: Task):
        new_tags = task.payload.new_tags
        _apply_new_tags_to_resumes(new_tags)
