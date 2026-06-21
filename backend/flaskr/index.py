from flask import Flask
from flask_cors import CORS

from flaskr import api_bp

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.register_blueprint(api_bp, url_prefix="/api")


@app.route("/")
def home():
    return "Welcome to the Flask API!"


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
