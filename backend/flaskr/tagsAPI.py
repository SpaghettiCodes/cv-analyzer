from flask import jsonify, request
from bson import ObjectId

from . import api_bp
from .db import pdf_collection, tags_collection


def list_all_tags():
    tags = []
    for tag in tags_collection.find({}):
        tag["_id"] = str(tag["_id"])
        tags.append(tag)
    return tags


@api_bp.route("/createTags", methods=["POST"])
def createTags():
    tags = request.json.get("tags")

    if not tags:
        return jsonify({"error": "No tags provided"}), 400

    if tags_collection.find_one({"tag_name": tags}):
        return jsonify({"error": "Tags already exist"}), 400

    tags_collection.insert_one({"tag_name": tags})
    return jsonify({"message": "Tags created successfully"}), 201


@api_bp.route("/getAllTags", methods=["GET"])
def getAllTags():
    return jsonify(list_all_tags()), 200


@api_bp.route("/getPdfWithTags", methods=["GET"])
def getPdfWithTags():
    tags_id = request.json.get("tags")

    if not tags_id:
        return jsonify({"error": "No tags provided"}), 400

    for tag_id in tags_id:
        if not ObjectId.is_valid(tag_id):
            return jsonify({"error": "Invalid tag id"}), 400

    pdfs = []
    for pdf in pdf_collection.find({"tags_id": {"$all": tags_id}}):
        pdf["_id"] = str(pdf["_id"])
        pdfs.append(pdf)

    if not pdfs:
        return jsonify({"error": "No pdfs found with the tags"}), 404
    return jsonify(pdfs), 200


@api_bp.route("/getTags", methods=["GET"])
def getTags():
    tags_array = request.args.get("tags")
    if not tags_array:
        return jsonify({"error": "No tags provided"}), 400

    tag_names = []
    for tag_id in tags_array.split(","):
        tag = tags_collection.find_one({"_id": ObjectId(tag_id.strip())})
        if not tag:
            return jsonify({"error": "Tags not found"}), 404
        tag_names.append(tag["tag_name"])

    return jsonify(tag_names), 200
