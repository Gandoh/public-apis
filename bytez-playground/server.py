#!/usr/bin/env python3
"""
BYTEZ://PLAYGROUND — zero-dependency server for the Bytez unified Model API.

One free key (https://bytez.com -> API Dashboard) unlocks 175k+ open-source
models: chat, text-to-image, vision, speech, embeddings — all through one
endpoint. This proxy keeps your key in memory (never logged, never written
to disk) and serves a browser playground at http://localhost:8787

Run:  python3 server.py            (or PORT=9000 python3 server.py)
Env:  BYTEZ_KEY=...                (optional; key can also be set in the UI)
"""
from __future__ import annotations

import json
import os
import socket
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

API_BASE = "https://api.bytez.com/models/v2"
PORT = int(os.environ.get("PORT", "8787"))
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
ENV_KEY = os.environ.get("BYTEZ_KEY", "").strip()

TIMEOUT_STATUS = 5
TIMEOUT_CATALOG = 60
TIMEOUT_INFERENCE = 600

# Curated free-tier-friendly models (open-source, small enough for the free
# plan which allows open models up to 7B parameters).
FEATURED = [
    # chat
    {"id": "Qwen/Qwen3-4B", "task": "chat", "label": "Qwen3 4B — sharp little generalist"},
    {"id": "meta-llama/Llama-3.2-3B-Instruct", "task": "chat", "label": "Llama 3.2 3B — Meta's pocket assistant"},
    {"id": "mistralai/Mistral-7B-Instruct-v0.3", "task": "chat", "label": "Mistral 7B — the classic"},
    {"id": "microsoft/Phi-3-mini-4k-instruct", "task": "chat", "label": "Phi-3 mini — punches above its weight"},
    {"id": "google/gemma-2-2b-it", "task": "chat", "label": "Gemma 2 2B — Google's tiny tutor"},
    {"id": "HuggingFaceTB/SmolLM2-1.7B-Instruct", "task": "chat", "label": "SmolLM2 — tiny and fast"},
    # image generation
    {"id": "dreamlike-art/dreamlike-photoreal-2.0", "task": "text-to-image", "label": "Dreamlike Photoreal 2.0"},
    {"id": "stabilityai/stable-diffusion-2-1", "task": "text-to-image", "label": "Stable Diffusion 2.1"},
    {"id": "stabilityai/sdxl-turbo", "task": "text-to-image", "label": "SDXL Turbo — fast drafts"},
    {"id": "black-forest-labs/FLUX.1-schnell", "task": "text-to-image", "label": "FLUX.1 schnell — may exceed free tier", "warn": True},
    # vision
    {"id": "Salesforce/blip-image-captioning-large", "task": "image-to-text", "label": "BLIP captioning (large)"},
    {"id": "nlpconnect/vit-gpt2-image-captioning", "task": "image-to-text", "label": "ViT-GPT2 captioning"},
    {"id": "facebook/detr-resnet-50", "task": "object-detection", "label": "DETR ResNet-50 object detection"},
    {"id": "google/owlv2-base-patch16-ensemble", "task": "zero-shot-object-detection", "label": "OWLv2 — detect anything you name"},
    {"id": "google/vit-base-patch16-224", "task": "image-classification", "label": "ViT classifier (1000 classes)"},
    # speech
    {"id": "facebook/mms-tts-eng", "task": "text-to-speech", "label": "MMS TTS (English) — Meta"},
    {"id": "facebook/fastspeech2-en-ljspeech", "task": "text-to-speech", "label": "FastSpeech2 (LJSpeech)"},
    {"id": "openai/whisper-base", "task": "automatic-speech-recognition", "label": "Whisper base — transcription"},
    {"id": "openai/whisper-small", "task": "automatic-speech-recognition", "label": "Whisper small — better accuracy"},
    # misc
    {"id": "sentence-transformers/all-MiniLM-L6-v2", "task": "feature-extraction", "label": "MiniLM embeddings"},
    {"id": "cerspense/zeroscope_v2_576w", "task": "text-to-video", "label": "Zeroscope v2 576w — tiny text-to-video", "warn": True},
]

DEFAULTS = {
    "chat": "Qwen/Qwen3-4B",
    "text-to-image": "dreamlike-art/dreamlike-photoreal-2.0",
    "image-to-text": "Salesforce/blip-image-captioning-large",
    "object-detection": "facebook/detr-resnet-50",
    "image-classification": "google/vit-base-patch16-224",
    "text-to-speech": "facebook/mms-tts-eng",
    "automatic-speech-recognition": "openai/whisper-base",
}


class UpstreamError(Exception):
    def __init__(self, message: str, status: int = 502, blocked: bool = False, detail=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.blocked = blocked
        self.detail = detail


class State:
    def __init__(self):
        self.lock = threading.Lock()
        self.key = ENV_KEY or None
        self.key_source = "env" if ENV_KEY else None
        self.auth_style = "raw"  # "raw" -> Authorization: KEY, "prefixed" -> Authorization: Key KEY
        self.catalog = None
        self.catalog_ts = 0.0

    def set_key(self, key: str):
        with self.lock:
            self.key = key.strip() or None
            self.key_source = "session" if self.key else ("env" if ENV_KEY else None)
            self.auth_style = "raw"
            self.catalog = None
            self.catalog_ts = 0.0

    def clear_key(self):
        self.set_key("")

    def masked(self):
        k = self.key
        if not k:
            return None
        if len(k) <= 8:
            return k[:2] + "••••"
        return k[:4] + "••••" + k[-4:]


STATE = State()


def mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return key[:2] + "••••"
    return key[:4] + "••••" + key[-4:]


def auth_header(key: str, style: str) -> str:
    return f"Key {key}" if style == "prefixed" else key


def http_upstream(path: str, method: str = "GET", body: bytes | None = None,
                  key: str | None = None, timeout: int = TIMEOUT_INFERENCE,
                  content_type: str = "application/json"):
    """Call api.bytez.com. Returns (status, headers, body_bytes).
    Raises UpstreamError with .blocked=True on connection-level failures."""
    url = path if path.startswith("http") else API_BASE + path
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", content_type)
    req.add_header("Accept", "application/json, text/event-stream")
    req.add_header("User-Agent", "bytez-playground/1.0")
    if key:
        with STATE.lock:
            style = STATE.auth_style
        req.add_header("Authorization", auth_header(key, style))
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.status, dict(resp.headers), resp  # body streamed by caller
    except urllib.error.HTTPError as e:
        try:
            payload = e.read()
        except Exception:
            payload = b""
        return e.code, dict(e.headers or {}), payload
    except (ssl.SSLError, socket.timeout, ConnectionError, OSError) as e:
        reason = getattr(e, "reason", None) or e
        raise UpstreamError(
            f"Cannot reach api.bytez.com from here: {reason}",
            status=502,
            blocked=True,
        )


def upstream_json(path: str, method: str = "GET", payload=None, key: str | None = None,
                  timeout: int = TIMEOUT_INFERENCE, media: bool = False):
    """JSON call with automatic 401 auth-style retry. Returns (status, data_or_bytes)."""
    body = json.dumps(payload).encode() if payload is not None else None
    status, headers, resp = http_upstream(path, method, body, key, timeout)

    def read_all(r):
        if isinstance(r, (bytes, bytearray)):
            return bytes(r)
        chunks = []
        while True:
            chunk = r.read(65536)
            if not chunk:
                break
            chunks.append(chunk)
        return b"".join(chunks)

    raw = read_all(resp)
    if status == 401 and key:
        # retry once with the alternative auth style
        with STATE.lock:
            new_style = "prefixed" if STATE.auth_style == "raw" else "raw"
        req = urllib.request.Request(
            (path if path.startswith("http") else API_BASE + path),
            data=body, method=method)
        req.add_header("Content-Type", "application/json")
        req.add_header("Authorization", auth_header(key, new_style))
        try:
            r2 = urllib.request.urlopen(req, timeout=timeout)
            status, raw = r2.status, read_all(r2)
            with STATE.lock:
                STATE.auth_style = new_style
        except urllib.error.HTTPError as e2:
            status, raw = e2.code, read_all(e2)
        except (ssl.SSLError, socket.timeout, ConnectionError, OSError) as e2:
            raise UpstreamError(f"Cannot reach api.bytez.com: {e2}", blocked=True)
    if media and isinstance(raw, bytes) and status == 200:
        return status, raw
    try:
        data = json.loads(raw.decode("utf-8", "replace")) if raw else None
    except json.JSONDecodeError:
        data = {"error": "unparseable upstream response", "raw": raw[:500].decode("utf-8", "replace")}
    return status, data


def probe_upstream():
    """Quick reachability check for the status panel."""
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection(("api.bytez.com", 443), timeout=TIMEOUT_STATUS) as sock:
            with ctx.wrap_socket(sock, server_hostname="api.bytez.com"):
                return {"reachable": True, "detail": "TLS handshake OK"}
    except Exception as e:  # noqa: BLE001
        return {"reachable": False, "detail": f"{type(e).__name__}: {getattr(e, 'reason', e)}"}


def fetch_catalog(key: str, force: bool = False):
    with STATE.lock:
        if STATE.catalog and not force and (time.time() - STATE.catalog_ts) < 3600:
            return STATE.catalog, None
    status, data = upstream_json("/list/models", "GET", None, key, TIMEOUT_CATALOG)
    if status != 200 or not isinstance(data, dict):
        msg = (data or {}).get("error") if isinstance(data, dict) else f"HTTP {status}"
        return None, msg or f"HTTP {status}"
    output = data.get("output") or []
    slim = []
    for item in output:
        if not isinstance(item, dict):
            continue
        mid = item.get("model") or item.get("id") or item.get("modelId")
        if not mid:
            continue
        slim.append({"id": mid, "task": item.get("task") or item.get("pipeline_tag") or ""})
    with STATE.lock:
        STATE.catalog = slim
        STATE.catalog_ts = time.time()
    return slim, None


def friendly_error(status: int, data):
    """Turn upstream error payloads into human hints."""
    base = None
    if isinstance(data, dict):
        base = data.get("error") or data.get("message")
    hints = {
        401: "Auth failed — check your key (get one free at bytez.com → API Dashboard).",
        402: "Out of credits or model too big for the free tier (open models ≤ 7B on free plan).",
        429: "Rate limited — free tier allows 1 concurrent request. Wait a moment and retry.",
    }
    hint = hints.get(status)
    if hint:
        return {"status": status, "error": base or "upstream error", "hint": hint, "upstream": data}
    return {"status": status, "error": base or "upstream error", "upstream": data}


class Handler(BaseHTTPRequestHandler):
    server_version = "BytezPlayground/1.0"

    # ---------- plumbing ----------
    def log_message(self, fmt, *args):  # quieter logs, never log bodies/keys
        print(f"[{time.strftime('%H:%M:%S')}] {self.command} {self.path.split('?')[0]}", flush=True)

    def _send(self, code: int, body: bytes, ctype: str = "application/json", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except BrokenPipeError:
            pass

    def _json(self, obj, code: int = 200):
        self._send(code, json.dumps(obj).encode())

    def _body_json(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        if n <= 0:
            return {}
        raw = self.rfile.read(min(n, 30 * 1024 * 1024))
        try:
            return json.loads(raw.decode("utf-8", "replace"))
        except json.JSONDecodeError:
            return {}

    def _require_key(self):
        key = STATE.key
        if not key:
            self._json({"error": "no-key", "hint": "Paste your free Bytez key (bytez.com → API Dashboard)."},
                       401)
            return None
        return key

    # ---------- routing ----------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)
        if route in ("/", "/index.html"):
            return self._serve_static("index.html")
        if route == "/api/status":
            return self.api_status()
        if route == "/api/models":
            return self.api_models(qs)
        if route == "/api/defaults":
            return self._json({"defaults": DEFAULTS, "featured": FEATURED})
        if route == "/api/key":
            k = STATE.key
            return self._json({"has_key": bool(k), "source": STATE.key_source, "masked": mask_key(k) if k else None})
        return self._json({"error": "not found"}, 404)

    def do_POST(self):
        route = urllib.parse.urlparse(self.path).path
        if route == "/api/key":
            body = self._body_json()
            STATE.set_key(str(body.get("key", "")))
            return self._json({"ok": True, "has_key": bool(STATE.key), "masked": mask_key(STATE.key or "")})
        if route.startswith("/api/run/"):
            return self.api_run(urllib.parse.unquote(route[len("/api/run/"):]))
        if route == "/api/chat":
            return self.api_chat()
        return self._json({"error": "not found"}, 404)

    def do_DELETE(self):
        if urllib.parse.urlparse(self.path).path == "/api/key":
            STATE.clear_key()
            return self._json({"ok": True, "has_key": bool(STATE.key)})
        return self._json({"error": "not found"}, 404)

    # ---------- static ----------
    def _serve_static(self, name: str):
        path = os.path.join(STATIC_DIR, name)
        if not os.path.isfile(path):
            return self._json({"error": "missing static file"}, 404)
        with open(path, "rb") as f:
            data = f.read()
        self._send(200, data, "text/html; charset=utf-8")

    # ---------- endpoints ----------
    def api_status(self):
        key = STATE.key
        result = {
            "has_key": bool(key),
            "key_source": STATE.key_source,
            "key_masked": mask_key(key) if key else None,
            "upstream": None,
            "auth_valid": None,
        }
        probe = probe_upstream()
        result["upstream"] = probe
        if key and probe["reachable"]:
            status, data = upstream_json("/list/tasks", "GET", None, key, TIMEOUT_STATUS)
            result["auth_valid"] = (status == 200)
            if status != 200 and isinstance(data, dict):
                result["auth_detail"] = data.get("error")
        return self._json(result)

    def api_models(self, qs):
        want_full = qs.get("full", ["0"])[0] in ("1", "true")
        payload = {"featured": FEATURED, "defaults": DEFAULTS, "catalog": None, "count": None, "error": None}
        if want_full:
            key = self._require_key()
            if not key:
                return
            slim, err = fetch_catalog(key)
            if err:
                payload["error"] = err
            else:
                payload["catalog"] = slim
                payload["count"] = len(slim)
        return self._json(payload)

    def api_run(self, model_id: str):
        key = self._require_key()
        if not key:
            return
        payload = self._body_json()
        status, data = upstream_json(f"/{model_id}", "POST", payload, key)
        if status == 200:
            return self._json(data if isinstance(data, dict) else {"error": None, "output": data})
        return self._json(friendly_error(status, data), status)

    def api_chat(self):
        key = self._require_key()
        if not key:
            return
        body = self._body_json()
        model = body.get("model") or DEFAULTS["chat"]
        messages = body.get("messages") or []
        params = body.get("params") or {}
        stream = bool(body.get("stream"))
        payload = {"model": model, "messages": messages, "stream": stream}
        if "temperature" in params:
            payload["temperature"] = params["temperature"]
        if "max_tokens" in params:
            payload["max_tokens"] = params["max_tokens"]
        path = "/openai/v1/chat/completions"
        if not stream:
            status, data = upstream_json(path, "POST", payload, key)
            if status == 200:
                return self._json(data)
            return self._json(friendly_error(status, data), status)
        # streaming passthrough (SSE)
        status, headers, resp = http_upstream(path, "POST", json.dumps(payload).encode(), key, TIMEOUT_INFERENCE)
        if status != 200:
            chunks = []
            try:
                while True:
                    c = resp.read(65536)
                    if not c:
                        break
                    chunks.append(c)
            except Exception:  # noqa: BLE001
                pass
            raw = b"".join(chunks)
            try:
                data = json.loads(raw.decode("utf-8", "replace"))
            except Exception:  # noqa: BLE001
                data = {"error": raw[:300].decode("utf-8", "replace")}
            return self._json(friendly_error(status, data), status)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            while True:
                chunk = resp.read(1024)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"▮ BYTEZ://PLAYGROUND  →  http://localhost:{PORT}", flush=True)
    print("  key: " + (mask_key(ENV_KEY) + " (env)" if ENV_KEY else "not set — paste one in the UI"), flush=True)
    print("  free tier: $1 credits refreshed every 4 weeks, open models ≤ 7B params", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nbye.")


if __name__ == "__main__":
    main()
