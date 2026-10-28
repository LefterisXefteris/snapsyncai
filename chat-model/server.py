"""HTTP shell for one Chat turn. The model key and the shared token stay here."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from turn import UNAVAILABLE, authorized, turn

PORT = int(os.environ.get("PORT", "8791"))
TOKEN = os.environ.get("CHAT_MODEL_TOKEN", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.2")
OPENAI_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1/chat/completions")


def complete(prompt: str) -> str:
    body = json.dumps(
        {
            "model": OPENAI_MODEL,
            "max_completion_tokens": 800,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Reply with one JSON object."},
                {"role": "user", "content": prompt},
            ],
        }
    ).encode()
    request = urllib.request.Request(
        OPENAI_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return json.dumps({"text": UNAVAILABLE, "done": True})
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        return json.dumps({"text": UNAVAILABLE, "done": True})
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        return json.dumps({"text": UNAVAILABLE, "done": True})
    return content


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/turn":
            self._send(404, {"text": UNAVAILABLE, "done": True})
            return
        if not authorized(self.headers.get("Authorization"), TOKEN):
            self._send(401, {"text": UNAVAILABLE, "done": True})
            return
        length = int(self.headers.get("Content-Length", "0") or 0)
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._send(400, {"text": UNAVAILABLE, "done": True})
            return
        if not isinstance(payload, dict):
            self._send(400, {"text": UNAVAILABLE, "done": True})
            return
        self._send(200, turn(payload, complete))

    def _send(self, status: int, body: dict) -> None:
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt: str, *args: object) -> None:
        return


def main() -> None:
    if not TOKEN or not OPENAI_API_KEY:
        raise SystemExit("CHAT_MODEL_TOKEN and OPENAI_API_KEY are required")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
