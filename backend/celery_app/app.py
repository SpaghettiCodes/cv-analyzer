from celery import Celery
from celery.signals import task_postrun
from bson import ObjectId
from datetime import datetime, timezone
import json

from flaskr.ai_client import client, MODEL_NAME
from flaskr.prompts import TAGS_JSON, TAGS_SUGGESTION_SCHEMA, JD_PARSED_SCHEMA
from flaskr.db import task_collection
from flaskr.resume import (
    _extract_text_from_stored_pdf, 
    _extract_text_from_upload, 
    _update_pdf_metadata, 
    _apply_new_tags_to_resumes,
    list_all_tags
)
from flaskr.mapper import task_to_summary
from flask_socketio import SocketIO
import os

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery("tasks", broker=redis_url, task_ignore_result=True)


socket_emitter = SocketIO(message_queue=redis_url)

def emit_snapshot():
    # circular dependency ahhh
    from flaskr.tasks import TaskService
    
    documents = task_collection.find().sort("created_at", -1)
    summaries = []
    for doc in documents:
        task_obj = TaskService._from_doc(doc) 
        summaries.append(task_to_summary(task_obj))
    socket_emitter.emit('snapshot', summaries, room='task_updates', namespace='/ws')    

def begin_running_task(task_id):
    task_collection.update_one(
        {"id": task_id}, 
        {"$set": {"status": "running", "started_at": datetime.now(timezone.utc), "error": None}}
    )
    emit_snapshot()

# update mongodb task state
def update_task_status(task_id: str, status: str, error: str = None, extra_fields: dict = None):
    update_doc = {
        "status": status,
        "error": error,
        "finished_at": datetime.now(timezone.utc) if status in ["completed", "failed", "pending-user-input"] else None
    }
    if extra_fields:
        update_doc.update(extra_fields)
        
    task_collection.update_one({"id": task_id}, {"$set": update_doc})

@celery_app.task(bind=True)
def run_resume_task(self, task_id: str, resume_id: str):
    begin_running_task(task_id)

    try:
        pdf_content = _extract_text_from_stored_pdf(resume_id)
        if not pdf_content:
            raise Exception(f"Unable to extract text from resume {resume_id}")

        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a HR that takes in a resume as text... format:\n{TAGS_JSON}\n"
                        f"Here are the tag name, _id and description:\n{list_all_tags()}\n"
                    ),
                },
                {"role": "user", "content": "match the tags that fit this resume:\n" + pdf_content},
            ],
            model=MODEL_NAME,
            response_format={"type": "json_object"},
        )
        result = json.loads(chat_completion.choices[0].message.content)
        _update_pdf_metadata(ObjectId(resume_id), result)
        
        update_task_status(task_id, "completed")
    except Exception as exc:
        update_task_status(task_id, "failed", error=str(exc))

@celery_app.task(bind=True)
def run_jd_task(self, task_id: str, file_path: str):
    begin_running_task(task_id)

    try:
        with open(file_path, "rb") as f:
            extract_text = _extract_text_from_upload(f)

        if not extract_text:
            raise Exception("Empty text content extracted from Job Description PDF")

        jd_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": f"Extract info structured into JSON format:\n{JD_PARSED_SCHEMA}"},
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
                {"role": "system", "content": f"Generate 3-5 tags... schema:\n{TAGS_SUGGESTION_SCHEMA}"},
                {"role": "user", "content": extract_text},
            ],
            model=MODEL_NAME,
            response_format={"type": "json_object"},
        )
        tag_result = json.loads(tag_completion.choices[0].message.content)
        suggested_tags = tag_result.get("tags", [])

        update_task_status(task_id, "pending-user-input", extra_fields={
            "payload.suggested_tags": suggested_tags,
            "payload.extracted_data": jd_data
        })
    except Exception as exc:
        update_task_status(task_id, "failed", error=str(exc))

@celery_app.task(bind=True)
def run_sync_task(self, task_id: str, new_tags: list[str]):
    begin_running_task(task_id)

    try:
        _apply_new_tags_to_resumes(new_tags)
        update_task_status(task_id, "completed")
    except Exception as exc:
        update_task_status(task_id, "failed", error=str(exc))


# fires automatically when any celery task finishes
@task_postrun.connect
def alert_socket_workers(sender=None, **kwargs):
    emit_snapshot()