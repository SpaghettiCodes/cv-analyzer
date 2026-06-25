from gevent import monkey
monkey.patch_all()

from flask import Flask, jsonify, current_app
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from flaskr import api_bp
from .tasks import TaskService
from .mapper import task_to_summary
from .db import pdf_collection
from bson import ObjectId
import json
import signal
import os

app = Flask(__name__)
redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
socketio = SocketIO(
    app, 
    cors_allowed_origins="*", 
    async_mode='gevent_uwsgi',
    message_queue=redis_url
)
task_service = TaskService(socketio)
app.task_service = task_service

CORS(app, resources={r"/api/*": {"origins": "*"}})

app.register_blueprint(api_bp, url_prefix="/api")

@app.route("/api/tasks", methods=["GET"])
def list_tasks_api():
    tasks = task_service.list_tasks()
    return jsonify([task_to_summary(t) for t in tasks])

@app.route("/api/tasks/<task_id>", methods=["GET"])
def get_task_api(task_id):
    try:
        task = task_service.load(task_id)
        summary = task_to_summary(task)
        
        if task.status == "completed":
            if task.type == "resume":
                resume_doc = pdf_collection.find_one({"_id": ObjectId(task.payload.resume)})
                if resume_doc:
                    resume_doc["_id"] = str(resume_doc["_id"])
                    summary["content"] = json.dumps(resume_doc, indent=2)
            elif task.type == "jd_sync":
                summary["content"] = f"Successfully synced tags: {task.payload.new_tags}"
        elif task.status == "pending-user-input" and task.type == "jd":
            summary["content"] = json.dumps(task.payload.extracted_data, indent=2)

        return jsonify(summary)
    except Exception as e:
        return jsonify({"error": str(e)}), 404

@socketio.on('connect', namespace='/ws')
def handle_tasks_connect():
    summaries = [task_to_summary(task) for task in task_service.list_tasks()]
    emit('snapshot', summaries)
    join_room('task_updates')

@socketio.on('disconnect', namespace='/ws')
def handle_tasks_disconnect():
    leave_room('task_updates')

def _handle_shutdown(signum, frame):
    task_service.stop_worker()

signal.signal(signal.SIGTERM, _handle_shutdown)
signal.signal(signal.SIGINT, _handle_shutdown)


if __name__ == "__main__":
    socketio.run(app, debug=True, host="0.0.0.0")
