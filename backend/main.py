from flask import Flask, request, jsonify
from flask_cors import CORS
import anthropic
import os

app = Flask(__name__)
CORS(app)

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json or {}
    team = data.get("team", [])
    lang = data.get("lang", "en")

    if not team:
        return jsonify({"error": "Empty team"}), 400

    system_msg, prompt = build_prompt(team, lang)

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=system_msg,
        messages=[{"role": "user", "content": prompt}],
    )

    return jsonify({"analysis": message.content[0].text})


def build_prompt(team, lang):
    lines = []
    for p in team:
        types  = "/".join(t["type"]["name"] for t in p.get("types", []))
        stats  = {s["stat"]["name"]: s["base_stat"] for s in p.get("stats", [])}
        abs_   = [a["name"] for a in p.get("abilities", []) if not a.get("is_hidden")]
        hidden = next((a["name"] for a in p.get("abilities", []) if a.get("is_hidden")), None)
        stat_s = (f"HP {stats.get('hp',0)} / Atk {stats.get('attack',0)} / "
                  f"Def {stats.get('defense',0)} / SpA {stats.get('special-attack',0)} / "
                  f"SpD {stats.get('special-defense',0)} / Spe {stats.get('speed',0)}")
        line = f"- {p['name'].replace('-',' ').title()} [{types}] {stat_s}"
        if abs_:
            line += f" | {', '.join(abs_)}"
        if hidden:
            line += f" (HA: {hidden})"
        lines.append(line)

    team_str = "\n".join(lines)

    if lang == "es":
        return (
            "Eres un experto en Pokémon competitivo. Responde siempre en español, de forma concisa y directa.",
            f"Analiza este equipo (máximo 220 palabras):\n{team_str}\n\n"
            "Responde con estas tres secciones:\n"
            "**Fortalezas** — qué hace bien el equipo\n"
            "**Debilidades** — tipos o estrategias que lo amenazan\n"
            "**Consejo** — 1-2 mejoras concretas",
        )
    return (
        "You are a competitive Pokémon expert. Be concise and practical.",
        f"Analyze this team (max 220 words):\n{team_str}\n\n"
        "Reply with these three sections:\n"
        "**Strengths** — what the team does well\n"
        "**Weaknesses** — types or strategies that threaten it\n"
        "**Tip** — 1-2 concrete improvements",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
