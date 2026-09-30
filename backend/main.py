"""NarcoLens Prahari proxy. The phone never sees the Sarvam key.

Run from this folder:
  pip install fastapi uvicorn httpx
  set SARVAM_API_KEY=your_key
  python -m uvicorn main:app --host 0.0.0.0 --port 8787

The Android build reads the public host from app.json extra.apiUrl
(or EXPO_PUBLIC_API_URL). Officers never type it. This laptop URL is only
for a local check: http://127.0.0.1:8787/health
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


def _load_env() -> None:
    """Read .env next to this file. A shell variable already set wins. Never log the value."""
    path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_env()
SARVAM = "https://api.sarvam.ai"
KEY = os.environ.get("SARVAM_API_KEY", "").strip()
TTS_LANGS = {"bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN"}

app = FastAPI(title="NarcoLens Prahari")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM = (
    "You are Prahari, the field assistant inside NarcoLens, an Android app for Indian "
    "police and NCB officers using a HAL NDPS reagent kit. Speak in the officer's language. "
    "Keep answers under 120 words. Quote only the kit facts below. Do not invent a colour, "
    "a drop count, or a shake time. If a step is not listed, say the kit card in the app is "
    "the source. Every result is presumptive and must go to a forensic lab. "
    "Do not give synthesis, extraction, concealment, or dosing instructions for any drug. "
    "If asked for those, refuse in one sentence and return to the field test.\n"
    "Test B, cannabis: match-head of sample, match-head of B1, 25 drops B2 and shake 1 minute, "
    "25 drops B3 and shake 2 minutes, stand 2 minutes. Read only the lower layer. "
    "Positive: orange to red in the lower layer.\n"
    "Test E part 1: match-head of powder, 1 drop E1 shake 10 seconds, 1 drop E2 shake 10 seconds. "
    "Positive: blue means cocaine or methaqualone. Then run part 2.\n"
    "Test E part 2: small amount, 5 drops E3, 3 drops E4. Green means cocaine. Yellow means methaqualone.\n"
    "Marquis: tiny amount, 2 to 3 drops, read within 60 seconds. Purple means opiates. "
    "Orange-brown means amphetamines. Black means MDMA.\n"
    "Mecke: tiny amount, 2 to 3 drops, within 60 seconds. Dark blue-green means opiates.\n"
    "Mandelin: tiny amount, 2 drops, within 60 seconds. Orange means ketamine. Dark green means amphetamines.\n"
    "Scott: sample, 3 drops. Blue means cocaine indicated.\n"
    "Photograph the plate top-down, all three wells visible, some white plate around each well."
)


class Turn(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    language: str = "en-IN"
    conversation_history: list[Turn] = []


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "sarvam": bool(KEY)}


@app.post("/api/voice/chat")
async def chat(body: ChatIn) -> dict[str, str]:
    if not KEY:
        return {"reply": "", "error": "Set SARVAM_API_KEY on the server. The app will use its offline answers until then."}
    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM + f" Reply in {body.language}."}]
    for turn in body.conversation_history[-8:]:
        if turn.role in {"user", "assistant"} and turn.content.strip():
            messages.append({"role": turn.role, "content": turn.content[:2000]})
    messages.append({"role": "user", "content": body.message})
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{SARVAM}/v1/chat/completions",
            headers={"api-subscription-key": KEY},
            json={
                "model": "sarvam-105b-conversations",
                "messages": messages,
                "temperature": 0.2,
                "max_tokens": 600,
                "reasoning_effort": None,
            },
        )
    if res.status_code >= 400:
        return {"reply": "", "error": f"Sarvam {res.status_code}"}
    data = res.json()
    text = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    return {"reply": text}


class AudioIn(BaseModel):
    audio: str = Field(min_length=20, max_length=8_000_000)
    mime: str = "audio/webm"
    language: str = "unknown"


class SpeechIn(BaseModel):
    text: str = Field(min_length=1, max_length=2500)
    language: str = "en-IN"


@app.post("/api/voice/stt")
async def stt(body: AudioIn) -> dict[str, str]:
    """Saaras v4. Short mic clips only (Sarvam REST limit is 30 seconds)."""
    if not KEY:
        return {"transcript": "", "error": "Set SARVAM_API_KEY on the server."}
    try:
        raw = base64.b64decode(body.audio, validate=False)
    except Exception:
        return {"transcript": "", "error": "The recording could not be read."}
    if not raw:
        return {"transcript": "", "error": "The recording was empty."}
    mime = body.mime if "/" in body.mime else "audio/webm"
    ext = "webm" if "webm" in mime else "m4a" if "mp4" in mime or "m4a" in mime else "wav"
    lang = body.language if body.language else "unknown"
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{SARVAM}/speech-to-text",
            headers={"api-subscription-key": KEY},
            files={"file": (f"speech.{ext}", raw, mime)},
            data={
                "model": "saaras:v4",
                "mode": "codemix",
                "language_code": lang,
                "keyterms": '["FIR","NDPS","Marquis","Mecke","Mandelin","Prahari","NarcoLens"]',
            },
        )
    if res.status_code >= 400:
        return {"transcript": "", "error": f"Sarvam {res.status_code}"}
    return {"transcript": (res.json().get("transcript") or "").strip()}


@app.post("/api/voice/tts")
async def tts(body: SpeechIn) -> dict[str, str]:
    """Bulbul v3. Returns one mp3 as base64. The phone never sees the key."""
    if not KEY:
        return {"audio": "", "error": "Set SARVAM_API_KEY on the server."}
    lang = body.language if body.language in TTS_LANGS else "en-IN"
    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{SARVAM}/text-to-speech",
            headers={"api-subscription-key": KEY, "Content-Type": "application/json"},
            json={
                "text": body.text[:2500],
                "language_code": lang,
                "speaker": "shubh",
                "model": "bulbul:v3",
                "pace": 1.0,
                "speech_sample_rate": 24000,
                "output_audio_codec": "mp3",
            },
        )
    if res.status_code >= 400:
        return {"audio": "", "error": f"Sarvam {res.status_code}"}
    audios = res.json().get("audios") or []
    audio = "".join(audios) if isinstance(audios, list) else ""
    if not audio:
        return {"audio": "", "error": "Sarvam returned no audio."}
    return {"audio": audio}


DOC_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string", "description": "Full name of the person named on the document"},
        "age": {"type": "integer", "description": "Age in years of that person"},
        "gender": {"type": "string", "description": "Gender exactly as printed, such as Male or Female"},
        "fir_no": {"type": "string", "description": "FIR number as printed, for example 123/2026"},
        "batch_no": {"type": "string", "description": "Batch or lot number printed on the drug kit label"},
        "expiry": {"type": "string", "description": "Expiry date exactly as printed"},
    },
}
DOC_TERMINAL = {"completed", "partially_completed", "failed", "rejected"}


class DocIn(BaseModel):
    image: str = Field(min_length=20, max_length=8_000_000)
    kind: str = "fir"
    language: str = "en-IN"


def _doc_text(result: dict[str, Any]) -> str:
    lines: list[str] = []
    if result.get("name"):
        lines.append(f"Name: {result['name']}")
    if result.get("age") not in (None, ""):
        lines.append(f"Age: {result['age']}")
    if result.get("gender"):
        lines.append(f"Gender: {result['gender']}")
    if result.get("fir_no"):
        lines.append(f"FIR No: {result['fir_no']}")
    if result.get("batch_no"):
        lines.append(f"Batch No: {result['batch_no']}")
    if result.get("expiry"):
        lines.append(f"Exp: {result['expiry']}")
    return "\n".join(lines)


@app.post("/api/doc/extract")
async def extract_doc(body: DocIn) -> dict[str, str]:
    """Sarvam Vision extract. The phone sends a JPEG; the key stays here."""
    if not KEY:
        return {"text": "", "error": "Set SARVAM_API_KEY on the server."}
    try:
        raw = base64.b64decode(body.image, validate=False)
    except Exception:
        return {"text": "", "error": "The photo could not be read."}
    if not raw:
        return {"text": "", "error": "The photo was empty."}
    headers = {"api-subscription-key": KEY}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
            keys = ("batch_no", "expiry") if body.kind == "kit" else ("name", "age", "gender", "fir_no")
            schema = {"type": "object", "properties": {key: DOC_SCHEMA["properties"][key] for key in keys}}
            created = await client.post(
                f"{SARVAM}/doc-ai/v1/job/extract",
                headers=headers,
                files=[("file", ("document.jpg", raw, "image/jpeg"))],
                data={
                    "schema": json.dumps(schema),
                    "language": body.language or "en-IN",
                    "output_format": "json",
                },
            )
            if created.status_code >= 400:
                return {"text": "", "error": f"Sarvam {created.status_code}"}
            job_id = created.json().get("job_id")
            if not job_id:
                return {"text": "", "error": "Sarvam did not start a document job."}
            status = "pending"
            for _ in range(40):
                await asyncio.sleep(5)
                polled = await client.get(f"{SARVAM}/doc-ai/v1/job/{job_id}/status", headers=headers)
                status = str((polled.json() or {}).get("status") or "").lower()
                if status in DOC_TERMINAL:
                    break
            else:
                return {"text": "", "error": "Document reading timed out. Try a smaller photo."}
            if status not in {"completed", "partially_completed"}:
                return {"text": "", "error": f"Document job {status or 'failed'}."}
            done = await client.get(f"{SARVAM}/doc-ai/v1/job/{job_id}/results", headers=headers)
            if done.status_code >= 400:
                return {"text": "", "error": f"Sarvam {done.status_code}"}
            result = done.json().get("result") or {}
            text = _doc_text(result if isinstance(result, dict) else {})
            if not text:
                return {"text": "", "error": "Sarvam returned no fields."}
            return {"text": text}
    except httpx.HTTPError:
        return {"text": "", "error": "Could not reach Sarvam."}
