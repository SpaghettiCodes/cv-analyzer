import json
import os
from collections import defaultdict

import requests
from bson import ObjectId
from dotenv import load_dotenv
from flask import jsonify, make_response, request, send_file
from pypdf import PdfReader

from . import api_bp
from .ai_client import MODEL_NAME, client
from .db import UPLOAD_DIR, jd_collection, pdf_collection
from .tagsAPI import list_all_tags

load_dotenv()

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")

os.makedirs(UPLOAD_DIR, exist_ok=True)

TAGS_JSON = (
    '{"name": "candidate name", "github": "github username", '
    '"tag_ids": ["tagid1", "tagid2", "tagid3"]}'
)

JD_JSON = (
    '{"title": "job title (string)","mode": "work location (string)",'
    '"type": "employment type (string)","position": "job position (string)",'
    '"location": "location of job (string)","description": "description of job (string)",'
    '"qualifications": {"pastExperience": [{"name": "name of experience (string)",'
    '"priority": "mandatory","minYears": 3}],'
    '"technical": [{"name": "name of technical skill (string)",'
    '"priority": "bonus","minYears": 2}],'
    '"soft": [{"name": "name of soft skill (string)",'
    '"priority": "normal","minYears": 1}]},'
    '"responsibilities": ["responsibilities of work (string)"]}'
)

ANALYSIS_JSON = (
    '{"name": "name", "summary": "short summary of past experiences.", '
    '"highlights": ["highlight1", "highlight2", "highlight3", "highlight4", "highlight5"], '
    '"qualifications": {"pastExperience": [{"name": "name of past experience", '
    '"priority": "priority", "minYears": 0, "qualified": "true / false (boolean)"}], '
    '"technical": [{"name": "name of technical skill", "priority": "priority", '
    '"minYears": 0, "qualified": "true / false (boolean)"}], '
    '"soft": [{"name": "name of soft skill", "priority": "priority", "minYears": 0, '
    '"qualified": "true / false (boolean)"}]}}'
)


def _pdf_path(resume_id):
    return os.path.join(UPLOAD_DIR, f"{resume_id}.pdf")


def _extract_text_from_upload(file):
    reader = PdfReader(file)
    return "".join(page.extract_text() or "" for page in reader.pages)


def _extract_text_from_stored_pdf(resume_id):
    path = _pdf_path(resume_id)
    if not os.path.isfile(path):
        return None
    with open(path, "rb") as pdf_file:
        return _extract_text_from_upload(pdf_file)


def _store_pdf(file):
    pdf_entry = {"original_filename": file.filename}
    inserted_id = pdf_collection.insert_one(pdf_entry).inserted_id

    stored_filename = f"{inserted_id}.pdf"
    file.save(_pdf_path(inserted_id))

    pdf_collection.update_one(
        {"_id": inserted_id},
        {"$set": {"stored_filename": stored_filename}},
    )
    return inserted_id


def _update_pdf_metadata(inserted_id, data):
    pdf_collection.update_one({"_id": inserted_id}, {"$set": data})


def _list_resumes():
    resumes = []
    for resume in pdf_collection.find({}):
        resume["_id"] = str(resume["_id"])
        resumes.append(resume)
    return resumes


def _resumes_for_job(job):
    job_tags = job.get("tags") or []
    if not isinstance(job_tags, list) or not job_tags:
        return _list_resumes()

    resumes = []
    seen = set()
    for resume in pdf_collection.find({}):
        tag_ids = resume.get("tag_ids", [])
        if not isinstance(tag_ids, list):
            continue
        if not any(tag in job_tags for tag in tag_ids):
            continue

        resume_id = str(resume["_id"])
        if resume_id in seen:
            continue
        seen.add(resume_id)
        resume["_id"] = resume_id
        resumes.append(resume)
    return resumes


@api_bp.route("/ai", methods=["POST"])
def openAI():
    if "File" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["File"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    inserted_id = _store_pdf(file)
    extract_text = _extract_text_from_upload(file)

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a HR that takes in a resume as text, your job is to match "
                        "which tags best suits the resume. The tags will be passed to you in json form\n"
                        f"The JSON object you return will be in this format:\n{TAGS_JSON}\n"
                        "the return JSON object must have between 1 to 3 _id in an array form "
                        "and only the id, and also the candidate name from the resume\n"
                        f"Here are the tag name, _id and description:\n{list_all_tags()}\n"
                        'if "github" / "name" cant be found remove the field'
                    ),
                },
                {
                    "role": "user",
                    "content": "match the tags that fit this resume:\n" + extract_text,
                },
            ],
            model=MODEL_NAME,
            response_format={"type": "json_object"},
        )
        result = json.loads(chat_completion.choices[0].message.content)
        _update_pdf_metadata(inserted_id, result)
        return jsonify({"msg": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/parseJD", methods=["POST"])
def parseJD():
    if "File" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    if request.form.get("tags") is None:
        return jsonify({"error": "No tags part in the request"}), 400

    file = request.files["File"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    tags = request.form.to_dict(flat=True)["tags"].split(",")
    extract_text = _extract_text_from_upload(file)

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a hr that takes in a job description as a string, extracts "
                        "its information and outputs it in JSON.\n"
                        f" The JSON object must use the schema:\n{JD_JSON}\n"
                        "\n There can be multiple pastExperience, technical and soft. "
                        "If a field has no matching value to the job description passed in, "
                        "the field itself can be empty"
                    ),
                },
                {
                    "role": "user",
                    "content": extract_text + "extract the job description",
                },
            ],
            model=MODEL_NAME,
            response_format={"type": "json_object"},
        )
        data = json.loads(chat_completion.choices[0].message.content)
        if not data.get("mode"):
            data["mode"] = "Remote"
        if not data.get("type"):
            data["type"] = "Full Time"
        jd_collection.insert_one({**data, "tags": tags})
        return jsonify({"msg": "pdf uploaded successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/getPDF", methods=["GET"])
def getPDF():
    resume_id = request.args.get("id")
    if not resume_id:
        return make_response("Resume id is required.", 400)

    file_path = _pdf_path(resume_id)
    if os.path.isfile(file_path):
        return send_file(file_path, as_attachment=True)
    return make_response(f"File '{resume_id}.pdf' not found.", 404)


@api_bp.route("/getAllResumes", methods=["GET"])
def getAllResumes():
    return jsonify(_list_resumes()), 200


def _analyse_single_resume(resume, job_description):
    extract_text = _extract_text_from_stored_pdf(resume["_id"])
    if extract_text is None:
        return None

    github_username = resume.get("github") or ""

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a hr that takes in a resume as a string, extract and summarize "
                        "its information and outputs it in JSON.\n"
                        f" The JSON object must use the schema:\n{ANALYSIS_JSON}\n"
                        f"\n The qualifications in the schema MUST follow the qualifications "
                        f"from this object:\n{job_description}\n"
                        "you have to check whether each qualifications are fulfilled by the resume "
                        "and add a 'qualified' field which sets a true / false boolean accordingly\n"
                    ),
                },
                {
                    "role": "user",
                    "content": extract_text + "summarize and match the qualifications",
                },
            ],
            model=MODEL_NAME,
            response_format={"type": "json_object"},
        )
        return {
            **json.loads(chat_completion.choices[0].message.content),
            "github": github_username,
        }
    except Exception:
        return None


@api_bp.route("/job/analysis", methods=["GET"])
def get_job_analysis():
    job_id = request.args.get("id")
    if job_id is None:
        return jsonify({"error": "Job ID is required"}), 400

    if not ObjectId.is_valid(job_id):
        return jsonify({"error": "Invalid Job ID format"}), 400

    job = jd_collection.find_one({"_id": ObjectId(job_id)})
    if not job:
        return jsonify({"error": "Job not found"}), 404

    analysis_all = []
    for resume in _resumes_for_job(job):
        analysis = _analyse_single_resume(resume, job)
        if analysis is None:
            continue
        analysis["_id"] = resume["_id"]
        analysis_all.append(analysis)

    return jsonify(analysis_all), 200


@api_bp.route("/github", methods=["GET"])
def github():
    username = request.args.get("username")
    if username is None:
        return jsonify({"error": "username non existent"}), 400

    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }

    repos_url = f"https://api.github.com/users/{username}/repos?type=public"
    repos_response = requests.get(repos_url, headers=headers, timeout=30)
    repos = repos_response.json()

    language_lines = defaultdict(int)
    for repo in repos:
        languages_response = requests.get(
            repo["languages_url"], headers=headers, timeout=30
        )
        for language, lines in languages_response.json().items():
            language_lines[language] += lines

    return jsonify(language_lines), 200
