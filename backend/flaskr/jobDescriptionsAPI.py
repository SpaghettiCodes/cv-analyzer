from flask import jsonify, request
from bson import ObjectId

from . import api_bp
from .db import jd_collection


@api_bp.route("/createJobDescription", methods=["POST"])
def createJobDescription():
    data = request.json

    required_fields = [
        "title",
        "mode",
        "type",
        "position",
        "location",
        "description",
        "qualifications",
        "responsibilities",
    ]
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    qualifications = data.get("qualifications", {})
    jd_collection.insert_one(
        {
            "title": data["title"],
            "mode": data["mode"],
            "type": data["type"],
            "position": data["position"],
            "location": data["location"],
            "description": data["description"],
            "qualifications": {
                "pastExperience": qualifications.get("pastExperience", []),
                "technical": qualifications.get("technical", []),
                "soft": qualifications.get("soft", []),
            },
            "responsibilities": data.get("responsibilities", []),
        }
    )

    return jsonify({"message": "Job description created successfully"}), 201


@api_bp.route("/getAllJobDescriptions", methods=["GET"])
def getAllJobDescriptions():
    job_descriptions = []
    for jd in jd_collection.find({}):
        jd["_id"] = str(jd["_id"])
        job_descriptions.append(jd)
    return jsonify(job_descriptions), 200


@api_bp.route("/getJobDescription", methods=["GET"])
def getJobDescription():
    jd_id = request.args.get("id")

    if not jd_id:
        return jsonify({"error": "No job description id provided"}), 400

    if not ObjectId.is_valid(jd_id):
        return jsonify({"error": "Invalid job description id"}), 400

    jd = jd_collection.find_one({"_id": ObjectId(jd_id)})
    if not jd:
        return jsonify({"error": "Job description not found"}), 404

    jd["_id"] = str(jd["_id"])
    return jsonify(jd), 200


@api_bp.route("/updateJobDescription", methods=["PUT"])
def updateJobDescription():
    data = request.json

    required_fields = [
        "_id",
        "title",
        "mode",
        "type",
        "position",
        "location",
        "description",
        "qualifications",
        "responsibilities",
    ]
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    jd_id = data["_id"]
    if not ObjectId.is_valid(jd_id):
        return jsonify({"error": "Invalid job description id"}), 400

    qualifications = data.get("qualifications", {})
    jd_collection.update_one(
        {"_id": ObjectId(jd_id)},
        {
            "$set": {
                "title": data["title"],
                "mode": data["mode"],
                "type": data["type"],
                "position": data["position"],
                "location": data["location"],
                "description": data["description"],
                "qualifications": {
                    "pastExperience": qualifications.get("pastExperience", []),
                    "technical": qualifications.get("technical", []),
                    "soft": qualifications.get("soft", []),
                },
                "responsibilities": data.get("responsibilities", []),
            }
        },
    )

    return jsonify({"message": "Job description updated successfully"}), 200


@api_bp.route("/deleteJobDescription", methods=["DELETE"])
def deleteJobDescription():
    jd_id = request.args.get("id")

    if not jd_id:
        return jsonify({"error": "No job description id provided"}), 400

    if not ObjectId.is_valid(jd_id):
        return jsonify({"error": "Invalid job description id"}), 400

    if not jd_collection.find_one({"_id": ObjectId(jd_id)}):
        return jsonify({"error": "Job description not found"}), 404

    jd_collection.delete_one({"_id": ObjectId(jd_id)})
    return jsonify({"message": "Job description deleted successfully"}), 200
