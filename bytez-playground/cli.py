#!/usr/bin/env python3
"""
BYTEZ://PLAYGROUND CLI — drive the Bytez Model API from your terminal.
Zero dependencies. Your key is read from BYTEZ_KEY (or --key) and never stored.

  python3 cli.py check                     key + network sanity check
  python3 cli.py models [--task chat]      browse the catalog
  python3 cli.py chat "explain quantum tunneling badly"
  python3 cli.py image "a hacker raccoon, neon, rain" -o raccoon.png
  python3 cli.py caption photo.jpg
  python3 cli.py detect photo.jpg
  python3 cli.py speak "hello world" -o hello.wav
  python3 cli.py listen recording.mp3
  python3 cli.py run OWNER/MODEL --data '{"text": "hi"}'
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request

API = "https://api.bytez.com/models/v2"
DEFAULTS = {
    "chat": "Qwen/Qwen3-4B",
    "image": "dreamlike-art/dreamlike-photoreal-2.0",
    "caption": "Salesforce/blip-image-captioning-large",
    "detect": "facebook/detr-resnet-50",
    "classify": "google/vit-base-patch16-224",
    "speak": "facebook/mms-tts-eng",
    "listen": "openai/whisper-base",
}
GREEN = "\033[92m"
DIM = "\033[2m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
OFF = "\033[0m"


def get_key(args) -> str:
    key = getattr(args, "key", None) or os.environ.get("BYTEZ_KEY", "").strip()
    if not key:
        sys.exit(
            f"{RED}no key.{OFF} Get a free one at https://bytez.com → API Dashboard, then:\n"
            f"  export BYTEZ_KEY=...   or   python3 cli.py --key ... <command>"
        )
    return key


def call(method: str, path: str, payload=None, key: str | None = None, raw: bool = False):
    req = urllib.request.Request(API + path, method=method)
    req.add_header("Content-Type", "application/json")
    if key:
        req.add_header("Authorization", key)
    data = json.dumps(payload).encode() if payload is not None else None
    try:
        resp = urllib.request.urlopen(req, data=data, timeout=600)
        body = resp.read()
        return resp.status, body if raw else json.loads(body or b"null")
    except urllib.error.HTTPError as e:
        body = e.read()
        if raw:
            return e.code, body
        try:
            return e.code, json.loads(body or b"null")
        except json.JSONDecodeError:
            return e.code, {"error": body.decode("utf-8", "replace")[:400]}
    except (urllib.error.URLError, OSError) as e:
        sys.exit(f"{RED}network error:{OFF} {e}\n"
                 f"(If this is a sandbox, its egress may block api.bytez.com — try from your machine.)")


def out_text(result):
    """Best-effort text extraction from a unified-run result."""
    if not isinstance(result, dict) or result.get("error"):
        return None
    o = result.get("output")
    if isinstance(o, str):
        return o
    if isinstance(o, list):
        if o and isinstance(o[0], dict):
            for k in ("generated_text", "translation_text", "summary_text", "answer", "label"):
                if k in o[0]:
                    return "\n".join(str(i.get(k)) for i in o if isinstance(i, dict))
        return "\n".join(str(i) for i in o)
    if isinstance(o, dict):
        for k in ("generated_text", "text", "answer"):
            if k in o:
                return str(o[k])
    return str(o)


def find_media(result):
    """Locate a URL or base64 payload in a unified-run result."""
    o = result.get("output") if isinstance(result, dict) else None
    def scan(x):
        if isinstance(x, str):
            if x.startswith("http://") or x.startswith("https://"):
                return {"url": x}
            if len(x) > 512:  # likely base64
                return {"b64": x}
        if isinstance(x, dict):
            for k in ("url", "image_url", "audio_url"):
                if isinstance(x.get(k), str) and x[k].startswith("http"):
                    return {"url": x[k]}
            for k in ("base64", "b64", "audio", "image", "content"):
                v = x.get(k)
                if isinstance(v, str) and len(v) > 512:
                    return {"b64": v}
        if isinstance(x, list):
            for item in x:
                found = scan(item)
                if found:
                    return found
        return None
    return scan(o)


def save_media(result, out_path: str) -> str | None:
    m = find_media(result)
    if not m:
        return None
    if "url" in m:
        req = urllib.request.Request(m["url"])
        with urllib.request.urlopen(req, timeout=300) as r, open(out_path, "wb") as f:
            f.write(r.read())
    else:
        with open(out_path, "wb") as f:
            f.write(base64.b64decode(m["b64"]))
    return out_path


def file_b64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def run_model(args, model: str, payload: dict, key: str):
    print(f"{DIM}▶ running {model} …{OFF}", flush=True)
    status, result = call("POST", f"/{model}", payload, key)
    if status != 200 or (isinstance(result, dict) and result.get("error")):
        hint = {401: "check your key", 402: "out of credits / model too big for free tier (≤7B)",
                429: "rate limited — free tier allows 1 concurrent request"}.get(status)
        sys.exit(f"{RED}error {status}:{OFF} {json.dumps(result)[:300]}" + (f"\n{DIM}hint: {hint}{OFF}" if hint else ""))
    return result


# ---------------- commands ----------------

def cmd_check(args):
    key = get_key(args)
    print(f"key  {GREEN}{key[:4]}••••{key[-4:]}{OFF}")
    status, data = call("GET", "/list/tasks", key=key)
    if status == 200:
        tasks = (data or {}).get("output") or []
        print(f"auth {GREEN}OK{OFF} — {len(tasks)} tasks available")
        print(f"api  {GREEN}reachable{OFF}")
    else:
        print(f"auth {RED}FAILED{OFF} ({status}): {json.dumps(data)[:200]}")


def cmd_models(args):
    key = get_key(args)
    status, data = call("GET", "/list/models", key=key)
    if status != 200:
        sys.exit(f"{RED}error {status}:{OFF} {json.dumps(data)[:300]}")
    models = (data or {}).get("output") or []
    print(f"{DIM}{len(models)} models{OFF}")
    shown = 0
    for m in models:
        if not isinstance(m, dict):
            continue
        if args.task and args.task not in (m.get("task") or ""):
            continue
        print(f"  {CYAN}{m.get('task', '?'):<32}{OFF} {m.get('model') or m.get('id')}")
        shown += 1
        if shown >= args.limit:
            break


def cmd_chat(args):
    key = get_key(args)
    model = args.model
    msgs = [{"role": "system", "content": "You are a terse, witty hacker assistant."}]
    if args.prompt:
        msgs.append({"role": "user", "content": args.prompt})
        _chat_once(args, model, msgs, key)
        return
    print(f"{DIM}chat REPL — {model} — ctrl-C to exit{OFF}")
    while True:
        try:
            text = input(f"{GREEN}you>{OFF} ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nbye.")
            return
        if not text:
            continue
        msgs.append({"role": "user", "content": text})
        reply = _chat_once(args, model, msgs, key)
        msgs.append({"role": "assistant", "content": reply})


def _chat_once(args, model, msgs, key):
    payload = {"model": model, "messages": msgs, "temperature": args.temperature,
               "max_tokens": args.max_tokens}
    status, data = call("POST", "/openai/v1/chat/completions", payload, key)
    if status != 200:
        sys.exit(f"{RED}error {status}:{OFF} {json.dumps(data)[:300]}")
    try:
        reply = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        sys.exit(f"{RED}unexpected shape:{OFF} {json.dumps(data)[:300]}")
    print(f"{BOLD}{reply}{OFF}")
    return reply


def cmd_image(args):
    key = get_key(args)
    result = run_model(args, args.model, {"text": args.prompt}, key)
    path = save_media(result, args.out)
    if path:
        print(f"{GREEN}saved → {path}{OFF}")
    else:
        print(f"{RED}no media in output:{OFF} {json.dumps(result)[:300]}")


def cmd_caption(args):
    key = get_key(args)
    result = run_model(args, args.model, {"base64": file_b64(args.image)}, key)
    print(out_text(result) or json.dumps(result)[:400])


def cmd_detect(args):
    key = get_key(args)
    result = run_model(args, args.model, {"base64": file_b64(args.image)}, key)
    o = result.get("output") or []
    for d in (o if isinstance(o, list) else [o]):
        if isinstance(d, dict):
            box = d.get("box") or {}
            print(f"  {d.get('label','?'):<20} {round(100 * float(d.get('score', 0))):>3}%  {box}")


def cmd_speak(args):
    key = get_key(args)
    result = run_model(args, args.model, {"text": args.text}, key)
    path = save_media(result, args.out)
    if path:
        print(f"{GREEN}saved → {path}{OFF}")
    else:
        print(f"{RED}no audio in output:{OFF} {json.dumps(result)[:300]}")


def cmd_listen(args):
    key = get_key(args)
    result = run_model(args, args.model, {"base64": file_b64(args.audio)}, key)
    print(out_text(result) or json.dumps(result)[:400])


def cmd_run(args):
    key = get_key(args)
    try:
        payload = json.loads(args.data)
    except json.JSONDecodeError as e:
        sys.exit(f"{RED}bad --data JSON:{OFF} {e}")
    result = run_model(args, args.model, payload, key)
    print(json.dumps(result, indent=2)[:4000])


def main():
    p = argparse.ArgumentParser(description="Bytez Playground CLI (free models, one key)")
    p.add_argument("--key", help="Bytez API key (or set BYTEZ_KEY env)")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("check").set_defaults(fn=cmd_check)

    m = sub.add_parser("models")
    m.add_argument("--task", default=None, help="filter by task, e.g. chat, text-to-image")
    m.add_argument("--limit", type=int, default=40)
    m.set_defaults(fn=cmd_models)

    c = sub.add_parser("chat")
    c.add_argument("prompt", nargs="?", default=None, help="omit for REPL")
    c.add_argument("-m", "--model", default=DEFAULTS["chat"])
    c.add_argument("--temperature", type=float, default=0.7)
    c.add_argument("--max-tokens", type=int, default=512)
    c.set_defaults(fn=cmd_chat)

    i = sub.add_parser("image")
    i.add_argument("prompt")
    i.add_argument("-m", "--model", default=DEFAULTS["image"])
    i.add_argument("-o", "--out", default="bytez-image.png")
    i.set_defaults(fn=cmd_image)

    cp = sub.add_parser("caption")
    cp.add_argument("image")
    cp.add_argument("-m", "--model", default=DEFAULTS["caption"])
    cp.set_defaults(fn=cmd_caption)

    d = sub.add_parser("detect")
    d.add_argument("image")
    d.add_argument("-m", "--model", default=DEFAULTS["detect"])
    d.set_defaults(fn=cmd_detect)

    s = sub.add_parser("speak")
    s.add_argument("text")
    s.add_argument("-m", "--model", default=DEFAULTS["speak"])
    s.add_argument("-o", "--out", default="bytez-speech.wav")
    s.set_defaults(fn=cmd_speak)

    l = sub.add_parser("listen")
    l.add_argument("audio")
    l.add_argument("-m", "--model", default=DEFAULTS["listen"])
    l.set_defaults(fn=cmd_listen)

    r = sub.add_parser("run")
    r.add_argument("model", help="owner/model, e.g. openai-community/gpt2")
    r.add_argument("--data", default='{"text": "Once upon a time"}', help="JSON body")
    r.set_defaults(fn=cmd_run)

    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
