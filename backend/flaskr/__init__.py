from flask import Blueprint

api_bp = Blueprint("api", __name__)

from . import jobDescriptionsAPI, resume, tagsAPI  # noqa: E402, F401
