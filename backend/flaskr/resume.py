import json
import os
from collections import defaultdict

import requests
from bson import ObjectId
from dotenv import load_dotenv
from flask import jsonify, make_response, request, send_file, current_app
from pypdf import PdfReader

from . import api_bp
from .ai_client import MODEL_NAME, client
from .db import UPLOAD_DIR, jd_collection, pdf_collection
from .tagsAPI import list_all_tags
from .task_model import Task
from .prompts import *
from concurrent.futures import ThreadPoolExecutor

load_dotenv()

GITHUB_USERNAME = os.environ.get("GITHUB_USERNAME")

os.makedirs(UPLOAD_DIR, exist_ok=True)

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
    service = current_app.task_service
    service.create_resume_task(inserted_id)
    return jsonify({"msg": 'ok'}), 200

def _resolve_tag_names(tag_ids):
    from .db import tags_collection

    names = []
    for tid in tag_ids or []:
        if not ObjectId.is_valid(tid):
            continue
        tag = tags_collection.find_one({"_id": ObjectId(tid)})
        if tag:
            names.append(tag["tag_name"])
    return names

def _match_new_tags_for_resume(resume_id, new_tags):
    if not new_tags:
        return []

    text = _extract_text_from_stored_pdf(resume_id)
    if not text:
        return []

    tags_payload = [{"_id": t["_id"], "tag_name": t["tag_name"]} for t in new_tags]

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an HR assistant. Given a resume and a list of NEW tags, "
                        "return only the tag _ids that genuinely match this candidate. "
                        "Be conservative — only match clear fits.\n"
                        f"Return JSON: {RESUME_NEW_TAGS_JSON}\n"
                        f"Available new tags:\n{json.dumps(tags_payload)}"
                    ),
                },
                {"role": "user", "content": text},
            ],
            model=MODEL_NAME,
            response_format={"type": "json_object"},
        )
        matched = json.loads(chat_completion.choices[0].message.content).get("tag_ids", [])
        valid_ids = {t["_id"] for t in new_tags}
        return [tid for tid in matched if tid in valid_ids]
    except Exception:
        return []


def _apply_new_tags_to_resumes(new_tag_ids):
    from .db import tags_collection

    if not new_tag_ids:
        return

    new_tags = []
    for tid in new_tag_ids:
        if not ObjectId.is_valid(tid):
            continue
        doc = tags_collection.find_one({"_id": ObjectId(tid)})
        if doc:
            new_tags.append({"_id": tid, "tag_name": doc["tag_name"]})

    if not new_tags:
        return

    for resume in pdf_collection.find({}):
        resume_id = str(resume["_id"])
        current = resume.get("tag_ids") or []
        if not isinstance(current, list):
            current = []

        unseen = [t for t in new_tags if t["_id"] not in current]
        if not unseen:
            continue

        matched = _match_new_tags_for_resume(resume_id, unseen)
        if not matched:
            continue

        merged = list(current)
        for tid in matched:
            if tid not in merged:
                merged.append(tid)

        pdf_collection.update_one({"_id": resume["_id"]}, {"$set": {"tag_ids": merged}})


def _get_or_create_tag(tag_name: str) -> tuple[str, bool]:
    from .db import tags_collection

    existing = tags_collection.find_one({"tag_name": tag_name})
    if existing:
        return str(existing["_id"]), False
    inserted = tags_collection.insert_one({"tag_name": tag_name})
    return str(inserted.inserted_id), True


@api_bp.route("/parseJD/analyze", methods=["POST"])
def parse_jd_analyze():
    if "File" not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files["File"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    import uuid
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_jd.pdf")
    file.save(file_path)

    service = current_app.task_service
    task = service.create_jd_task(file_path, file.filename)
    return jsonify({"msg": "ok", "task_id": task.id}), 200

@api_bp.route("/parseJD/confirm", methods=["POST"])
def parse_jd_confirm():
    payload = request.json
    
    extracted_data = payload.get("extracted_data")
    final_tags = payload.get("final_tags", [])
    task_id = payload.get("task_id")

    if not extracted_data:
        return jsonify({"error": "Missing job description data"}), 400

    try:
        from datetime import datetime, timezone
        tag_ids = []
        newly_created = []
        for tag_name in final_tags:
            if tag_name.strip():
                tid, created = _get_or_create_tag(tag_name.strip())
                tag_ids.append(tid)
                if created:
                    newly_created.append(tid)

        extracted_data["tags"] = tag_ids

        jd_collection.insert_one(extracted_data)
            
        service = current_app.task_service

        if task_id:
            try:
                task = service.load(task_id)
                task.status = "completed"
                task.finished_at = datetime.now(timezone.utc)
                service.save(task)
                service.broadcast_tasks()
            except Exception as e:
                print(f"Error completing task {task_id}: {e}")

        service.create_sync_task(newly_created)        
        return jsonify({"message": "Job description and tags saved successfully!"}), 201

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
            "id": str(resume["_id"]),
            "github": github_username,
        }
    except Exception:
        return None

@api_bp.route("/job/analysis", methods=["GET"])
def job_analysis():
    job_id = request.args.get("id")
    if not job_id:
        return jsonify({"error": "Job description ID is required"}), 400

    if not ObjectId.is_valid(job_id):
        return jsonify({"error": "Invalid job description ID"}), 400

    jd = jd_collection.find_one({"_id": ObjectId(job_id)})
    if not jd:
        return jsonify({"error": "Job description not found"}), 404

    jd.pop("_id", None)
    jd_string = json.dumps(jd)

    tag_ids = jd.get("tags", [])

    if tag_ids:
        query = {"tag_ids": {"$in": tag_ids}}
    else:
        return jsonify([]), 200

    resumes = list(pdf_collection.find(query))
    if not resumes:
        return jsonify([]), 200
    
    for r in resumes:
        r["_id"] = str(r["_id"])
        
    return jsonify(resumes), 200

@api_bp.route("/job/analyze_single", methods=["GET"])
def job_analyze_single():
    job_id = request.args.get("jobId")
    resume_id = request.args.get("resumeId")

    if not job_id or not resume_id:
        return jsonify({"error": "jobId and resumeId are required"}), 400

    if not ObjectId.is_valid(job_id) or not ObjectId.is_valid(resume_id):
        return jsonify({"error": "Invalid IDs"}), 400

    jd = jd_collection.find_one({"_id": ObjectId(job_id)})
    if not jd:
        return jsonify({"error": "Job description not found"}), 404
    jd.pop("_id", None)
    jd_string = json.dumps(jd)

    resume = pdf_collection.find_one({"_id": ObjectId(resume_id)})
    if not resume:
        return jsonify({"error": "Resume not found"}), 404
        
    analysis_result = _analyse_single_resume(resume, jd_string)
    
    if analysis_result is None:
        return jsonify({"error": "Failed to analyze resume"}), 500

    return jsonify(analysis_result), 200

@api_bp.route("/github", methods=["GET"])
def github():
    username = request.args.get("username")
    if not username:
        return jsonify({"error": "username non existent"}), 400

    headers = {
        'User-Agent': GITHUB_USERNAME,
        "Accept": "application/vnd.github.v3+json",
    }

    repos_url = f"https://api.github.com/users/{username}/repos?type=public"
    repos_response = requests.get(repos_url, headers=headers, timeout=30)
    if repos_response.status_code != 200:
        return jsonify({"error": f"GitHub API error: {repos_response.status_code}"}), repos_response.status_code
        
    repos = repos_response.json()
    if isinstance(repos, dict) and "message" in repos:
        return jsonify({"error": repos["message"]}), 400
    if not isinstance(repos, list):
        return jsonify({"error": "Unexpected structure from GitHub API"}), 500

    language_lines = defaultdict(int)
    for repo in repos:
        if not isinstance(repo, dict) or "languages_url" not in repo:
            continue
        print(f"Trying {repo['languages_url']}")
        languages_response = requests.get(
            repo["languages_url"], headers=headers, timeout=30
        )
        print(languages_response)
        if languages_response.status_code != 200:
            continue
        languages_data = languages_response.json()
        if isinstance(languages_data, dict):
            for language, lines in languages_data.items():
                language_lines[language] += lines

    print(f"Final result: {language_lines}")
    return jsonify(language_lines), 200

@api_bp.route("/resume/profile", methods=["GET"])
def resume_profile():
    resume_id = request.args.get("id")
    if not resume_id:
        return jsonify({"error": "Resume id is required"}), 400
    if not ObjectId.is_valid(resume_id):
        return jsonify({"error": "Invalid resume id"}), 400

    resume = pdf_collection.find_one({"_id": ObjectId(resume_id)})
    if not resume:
        return jsonify({"error": "Resume not found"}), 404

    tag_ids = resume.get("tag_ids") or []
    tag_names = _resolve_tag_names(tag_ids)

    recommended_jobs = []
    for jd in jd_collection.find({}):
        job_tags = jd.get("tags") or []
        overlap = [t for t in tag_ids if t in job_tags]
        if overlap:
            recommended_jobs.append({
                "_id": str(jd["_id"]),
                "title": jd.get("title", "Untitled"),
                "mode": jd.get("mode", ""),
                "location": jd.get("location", ""),
                "match_count": len(overlap),
            })
    recommended_jobs.sort(key=lambda j: j["match_count"], reverse=True)
    recommended_jobs = recommended_jobs[:5]

    text = _extract_text_from_stored_pdf(resume_id)
    profile = {"strong_aspects": [], "interesting_facts": [], "career_summary": ""}

    if text:
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a career coach. From this resume, extract standout strengths "
                            "and interesting facts. Be specific and concise.\n"
                            f"Return JSON:\n{PROFILE_JSON}"
                        ),
                    },
                    {"role": "user", "content": text},
                ],
                model=MODEL_NAME,
                response_format={"type": "json_object"},
            )
            profile = json.loads(chat_completion.choices[0].message.content)
        except Exception:
            pass

    return jsonify({
        "name": resume.get("name", ""),
        "github": resume.get("github", ""),
        "tag_names": tag_names,
        "strong_aspects": profile.get("strong_aspects", []),
        "interesting_facts": profile.get("interesting_facts", []),
        "career_summary": profile.get("career_summary", ""),
        "recommended_jobs": recommended_jobs,
    }), 200


@api_bp.route("/deleteResume", methods=["DELETE"])
def deleteResume():
    resume_id = request.args.get("id")
    if not resume_id:
        return make_response("Resume id is required.", 400)

    if not ObjectId.is_valid(resume_id):
        return make_response("Invalid resume id.", 400)

    result = pdf_collection.delete_one({"_id": ObjectId(resume_id)})
    if result.deleted_count == 0:
        return make_response("Resume not found.", 404)

    file_path = _pdf_path(resume_id)
    if os.path.isfile(file_path):
        os.remove(file_path)

    return jsonify({"msg": "Resume deleted successfully"}), 200

@api_bp.route("/resume/compare_ai", methods=["GET"])
def compare_resumes_ai():
    id_a = request.args.get("idA")
    id_b = request.args.get("idB")
    job_id = request.args.get("jobId")

    if not id_a or not id_b or not job_id:
        return jsonify({"error": "idA, idB, and jobId are required"}), 400

    if not ObjectId.is_valid(id_a) or not ObjectId.is_valid(id_b) or not ObjectId.is_valid(job_id):
        return jsonify({"error": "Invalid IDs provided"}), 400

    # Extract text from both candidate PDFs using existing helper functions
    text_a = _extract_text_from_stored_pdf(id_a)
    text_b = _extract_text_from_stored_pdf(id_b)
    jd_doc = jd_collection.find_one({"_id": ObjectId(job_id)})

    if not text_a or not text_b or not jd_doc:
        return jsonify({"error": "Data not found"}), 404

    jd_info = f"Title: {jd_doc.get('title')}\nDescription: {jd_doc.get('description')}"

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert technical recruiter. Compare Candidate A and Candidate B "
                        "against the provided job description. Evaluate their alignment, professional history, "
                        "strengths (pros), and missing skills or structural gaps (cons).\n"
                        "Return your response in strict JSON format matching this exact schema:\n"
                        "{\n"
                        "  \"candidateA\": {\n"
                        "    \"pros\": [\"bullet point\", \"bullet point\"],\n"
                        "    \"cons\": [\"bullet point\", \"bullet point\"]\n"
                        "  },\n"
                        "  \"candidateB\": {\n"
                        "    \"pros\": [\"bullet point\", \"bullet point\"],\n"
                        "    \"cons\": [\"bullet point\", \"bullet point\"]\n"
                        "  },\n"
                        "  \"comparative_summary\": \"A short 5-6 sentence evaluation summary contrasting the two candidates.\"\n"
                        "}"
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Job Description:\n{jd_info}\n\n"
                        f"Candidate A Resume Text:\n{text_a}\n\n"
                        f"Candidate B Resume Text:\n{text_b}\n"
                    ),
                },
            ],
            model=MODEL_NAME,
            response_format={"type": "json_object"},
        )
        result = json.loads(chat_completion.choices[0].message.content)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500