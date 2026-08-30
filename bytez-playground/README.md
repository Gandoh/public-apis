# ⚡ BYTEZ://PLAYGROUND

A zero-dependency playground for the [Bytez Model API](https://docs.bytez.com) — the unified
inference API from that *"stop paying for AI APIs"* short: **one free key → 175,000+ open-source
models** across text, image, vision, audio and video.

```
┌──────────────────────────────────────────────────────────┐
│  BYTEZ://PLAYGROUND                                      │
│  chat · text→image · vision · speech · 175k model index  │
│  python3 server.py  →  http://localhost:8787             │
└──────────────────────────────────────────────────────────┘
```

## Why Bytez

| | |
|---|---|
| **One key, one protocol** | `POST https://api.bytez.com/models/v2/{owner}/{model}` for every task |
| **OpenAI-compatible** | `https://api.bytez.com/models/v2/openai/v1` works with any OpenAI SDK |
| **Free tier** | $0/month, **$1 in credits refreshed every 4 weeks**, open models ≤ 7B params |
| **Scale when ready** | paid tiers unlock up to 120B models + more concurrency |

## Quick start

1. **Get a free key** — sign up at [bytez.com](https://bytez.com) → **API Dashboard** → copy key.
2. **Run the server**
   ```bash
   python3 server.py                 # no pip install needed — stdlib only
   # optional: BYTEZ_KEY=... python3 server.py
   ```
3. **Open the playground** at `http://localhost:8787`, click **⚿ KEY**, paste your key.
4. Chat, generate images, caption/detect images, synthesize speech, transcribe audio,
   and search the full 175k-model catalog.

## CLI (same folder)

```bash
export BYTEZ_KEY=...
python3 cli.py check                                  # key + network sanity
python3 cli.py models --task text-to-image            # browse catalog
python3 cli.py chat "explain zero-day like I'm five"  # one-shot
python3 cli.py chat                                   # REPL
python3 cli.py image "neon hacker raccoon, rain" -o raccoon.png
python3 cli.py caption photo.jpg
python3 cli.py detect photo.jpg
python3 cli.py speak "the machine is awake" -o hello.wav
python3 cli.py listen recording.mp3
python3 cli.py run OWNER/MODEL --data '{"text": "hi"}'
```

## How the key is handled

- Read from the `BYTEZ_KEY` env var or pasted into the UI → kept **in server memory only**.
- Never written to disk, never logged, never sent anywhere except `api.bytez.com`.
- `DELETE /api/key` clears it.

## HTTP surface (the proxy)

| Route | Purpose |
|---|---|
| `GET /api/status` | key presence/validity + upstream reachability diagnostics |
| `POST /api/key {key}` / `DELETE /api/key` | set / clear key (session-only) |
| `GET /api/defaults` | curated free-tier-friendly models |
| `GET /api/models?full=1` | full catalog (slimmed: id + task, cached 1 h) |
| `POST /api/run/{owner}/{model}` | unified run — body passthrough (`text`, `messages`, `base64`, `url`, `params`, …) |
| `POST /api/chat` | OpenAI-compatible chat (`stream: true` → SSE passthrough) |

## Sandbox note

Some sandboxed environments allowlist outbound hosts and block `api.bytez.com`. The status
bar detects this (`api blocked`) and tells you exactly what's wrong — run `python3 server.py`
on your own machine for the full experience.

## Free-tier gotchas

- **402** → out of credits or model too big (free plan runs open models up to **7B parameters**).
- **429** → free plan allows **1 concurrent request**; wait a beat and retry.
- Cold starts on serverless GPUs can take **20–60 s** — the first request of a session is the slow one.
- Credits expire 4 weeks after grant. Use them or lose them.
