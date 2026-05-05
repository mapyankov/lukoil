from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SCENARIO_MESSAGES = {
    "uav_threat": "Оповещение об угрозе атаки БПЛА отправлено по всем каналам.",
    "incident_info": "Персонал проинформирован о нештатной ситуации и инструкциях."
}


@app.get("/api/health")
def health_check():
    return jsonify({"status": "ok"})


@app.post("/api/notify")
def notify():
    payload = request.get_json(silent=True) or {}
    scenario = payload.get("scenario")

    if scenario not in SCENARIO_MESSAGES:
        return jsonify({"message": "Неизвестный сценарий оповещения."}), 400

    return jsonify({"message": SCENARIO_MESSAGES[scenario]})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
