from flask import Flask, request, jsonify
from flask_cors import CORS
import anthropic
import os

app = Flask(__name__)

ALLOWED_ORIGINS = [
    "https://periprepuci.github.io",
    "http://localhost",
    "http://localhost:5500",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:3000",
]
CORS(app, origins=ALLOWED_ORIGINS)

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
        max_tokens=700,
        system=system_msg,
        messages=[{"role": "user", "content": prompt}],
    )

    return jsonify({"analysis": message.content[0].text})


def build_prompt(team, lang):
    lines = []
    for p in team:
        name   = p["name"].replace("-", " ").title()
        types    = "/".join(t["type"]["name"] for t in p.get("types", []))
        stats    = {s["stat"]["name"]: s["base_stat"] for s in p.get("stats", [])}
        ability  = p.get("selectedAbility", "").strip()
        item     = p.get("item", "").strip()
        moves    = [m.strip() for m in p.get("moves", []) if str(m).strip()]

        stat_s = (f"HP {stats.get('hp',0)} / Atk {stats.get('attack',0)} / "
                  f"Def {stats.get('defense',0)} / SpA {stats.get('special-attack',0)} / "
                  f"SpD {stats.get('special-defense',0)} / Spe {stats.get('speed',0)}")

        line = f"- {name} [{types}] {stat_s}"
        if ability:
            line += f" | Ability: {ability}"
        if item:
            line += f" | Item: {item}"
        if moves:
            line += f" | Moves: {', '.join(moves)}"
        lines.append(line)

    team_str = "\n".join(lines)

    if lang == "es":
        return (
            "Eres un experto en Pokémon competitivo VGC (VideoGame Championships). "
            "El formato VGC es dobles: se usan 4 de los 6 Pokémon del equipo en cada batalla, "
            "enviando 2 al campo simultáneamente. Responde siempre en español, de forma concisa y directa.",
            f"Analiza este equipo para el formato VGC (dobles) (máximo 350 palabras):\n\n{team_str}\n\n"
            "Responde con estas cinco secciones:\n"
            "**Cobertura ofensiva** — qué tipos cubren bien los movimientos del equipo\n"
            "**Debilidades del equipo** — tipos, estrategias o leads que más amenazan al equipo en dobles\n"
            "**Sinergia de objetos** — si los objetos elegidos encajan con cada Pokémon en un contexto de dobles\n"
            "**Sugerencias de movimientos** — movimientos de apoyo o cobertura útiles en VGC que mejorarían el equipo\n"
            "**Consejo final** — 1-2 mejoras concretas teniendo en cuenta la dinámica de dobles",
        )
    return (
        "You are a competitive Pokémon VGC (Video Game Championships) expert. "
        "VGC is a doubles format: teams bring 6 Pokémon but only use 4 per battle, "
        "sending 2 onto the field at a time. Be concise and practical.",
        f"Analyze this VGC doubles team (max 350 words):\n\n{team_str}\n\n"
        "Reply with exactly these five sections:\n"
        "**Offensive Coverage** — what types the team's moves cover well\n"
        "**Team Weaknesses** — types, strategies or leads that most threaten the team in doubles\n"
        "**Item Synergy** — whether each item fits its Pokémon in a doubles context\n"
        "**Move Suggestions** — support or coverage moves useful in VGC that would improve the team\n"
        "**Final Tip** — 1-2 concrete improvements considering the doubles dynamic",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
