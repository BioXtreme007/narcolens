# Sarvam AI API - Integration Reference (verified 2026-09-30)

Sources: docs.sarvam.ai `.md` pages, `api-reference/openapi/apis.json` (OpenAPI 3.1), `asyncapi.json`.
Tip: fetch the real spec with `curl -H "Accept: application/json" -A "Mozilla/5.0" https://docs.sarvam.ai/api-reference/openapi/apis.json`
(plain curl on `/openapi.json` returns an HTML index). Items marked **[UNVERIFIED]** were not confirmed against the spec.

## 0. Global

- Base URL: `https://api.sarvam.ai` (WebSockets: `wss://api.sarvam.ai/...`)
- Auth (all endpoints): header `api-subscription-key: <KEY>`. Alternative accepted everywhere: `Authorization: Bearer <KEY>`.
  Invalid key returns **403** `invalid_api_key_error` (not 401). WebSocket: header `Api-Subscription-Key`.
- Error shape: `{"error": {"message": "...", "code": "invalid_request_error|unprocessable_entity_error|insufficient_quota_error|rate_limit_exceeded_error|not_found_error|internal_server_error|..."}}`
  Status: 400 bad params, 403 auth, 422 validation/file, 429 rate limit or credits exhausted (`insufficient_quota_error`), 500/503 retry with backoff.
- Python SDK: `pip install sarvamai` -> `from sarvamai import SarvamAI, AsyncSarvamAI`;
  `client = SarvamAI(api_subscription_key=KEY)`. Sync and async have identical method names. Errors: `from sarvamai.core.api_error import ApiError` (`.status_code`, `.body`).
- Language codes: BCP-47 `xx-IN`. 23-language set (STT, Translate, Vision): hi-IN bn-IN kn-IN ml-IN mr-IN od-IN pa-IN ta-IN te-IN en-IN gu-IN as-IN ur-IN ne-IN kok-IN ks-IN sd-IN sa-IN sat-IN mni-IN brx-IN mai-IN doi-IN.
  11-language set (Bulbul v3, Mayura, Sarvam-105B): hi bn ta te gu kn ml mr pa od en (all `-IN`).
- Recommended for FastAPI: one shared `httpx.AsyncClient(base_url="https://api.sarvam.ai", headers={"api-subscription-key": KEY}, timeout=httpx.Timeout(60, connect=10))`.
  Do NOT put `Content-Type` in default headers (breaks multipart).

## 1. Speech-to-Text REST (Saaras)

- `POST https://api.sarvam.ai/speech-to-text`, `multipart/form-data`
- Models: **`saaras:v4`** (default, latest; adds Global English + `keyterms`), `saaras:v3`. Saarika is legacy (not in the request enum); `saaras:v2.5` and older are deprecated.
- Fields:

  | field | type | notes |
  |---|---|---|
  | `file` | binary, required | a file part, not a path string |
  | `model` | str | `saaras:v3` / `saaras:v4` |
  | `mode` | str, default `transcribe` | `transcribe`, `translate` (to English), `verbatim`, `translit` (Roman script), `codemix` |
  | `language_code` | str | `unknown` (auto-detect; also auto if omitted) or any 23-set code |
  | `with_timestamps` | bool, default false | chunk-level only |
  | `input_audio_codec` | str | REQUIRED only for raw PCM (`pcm_s16le`,`pcm_l16`,`pcm_raw`, 16 kHz). Enum also: wav,x-wav,wave,mp3,mpeg,mpeg3,x-mp3,aac,x-aac,aiff,x-aiff,ogg,opus,flac,x-flac,mp4,x-m4a,amr,x-ms-wma,webm |
  | `keyterms` | JSON array string | v4 only; max 50 terms x 64 chars, e.g. `'["NDPS","Marquis"]'` |

- Response 200: `{"request_id": str, "transcript": str, "timestamps": obj|null, "diarized_transcript": obj|null, "language_code": "hi-IN"|null, "language_probability": 0..1|null}`
- Limits: **30 s max per REST request** (longer -> 422; use batch or chunk). 16 kHz mono recommended, 8 kHz OK. REST guide lists WAV, MP3, AAC, FLAC, OGG; model page/spec also lists AIFF, OPUS, MP4/M4A, AMR, WMA, WebM.
  Android MediaRecorder AAC/M4A (`mp4`/`x-m4a`) and AMR are in the codec enum **[UNVERIFIED in practice; test on device]**. Safest: record 16 kHz mono 16-bit WAV/PCM.
- Rate limit: Starter 60 req/min, Pro 100, Business 4000. Price Rs 30/hour audio (Rs 45 with diarization).
- Mode choice: `codemix` for Hinglish commands, `transcribe` for dictation, `translate` for English text from Indic speech.

```python
import httpx
async def stt(audio: bytes, filename="a.wav", mime="audio/wav", lang="unknown", mode="codemix"):
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post("https://api.sarvam.ai/speech-to-text",
            headers={"api-subscription-key": KEY},
            files={"file": (filename, audio, mime)},
            data={"model": "saaras:v4", "mode": mode, "language_code": lang,
                  "keyterms": '["FIR","NDPS","Marquis"]'})
        r.raise_for_status(); return r.json()   # ["transcript"], ["language_code"]
```
SDK: `client.speech_to_text.transcribe(file=open("a.wav","rb"), model="saaras:v4", mode="codemix", language_code="unknown", keyterms=[...])`

## 2. Streaming STT (WebSocket)

Audio on WS: only WAV or raw PCM (no mp3/aac). Concurrency: Starter 20, Pro/Business 100 (burst-opened connections rejected with close 1003; space them out).

### 2a. Realtime (newer, recommended for live voice): `wss://api.sarvam.ai/speech-to-text-realtime/ws`
- Auth: header `api-subscription-key` (SDK adds it). Query params: `language_code` (required; `auto` or codes; **Odia is `or-IN` here**), `model` (`saaras:v3-realtime` default | `saaras:v4`), `stream_type` (`fast`|`balanced` default|`simulated`), `mode` (finals only), `endpointing` (`vad` default|`manual`), `encoding` (`linear16` default|`linear32`|`mulaw`|`alaw`; mono), `sample_rate` (8000|16000 only, default 16000), `threshold` 0.3, `silence_duration_ms` 500, `min_speech_duration_ms` 250, `return_timestamps`, `prompt`, `keyterms` (JSON array string, v4).
- Client -> server JSON: `{"event":"audio_input","audio":"<base64 PCM>"}`, `{"event":"end"}`, `{"event":"ping"}`, `{"event":"config.update",...}`; manual mode: `speech_start`/`speech_end`/`flush`.
- Server -> client `event`: `session.begin`, `vad.speech_start`, `vad.speech_end`, `transcript.partial` (`text`), `transcript.final` (`text`; plus `language`, `language_confidence` when auto), `config.updated`, `pong`, `session.end` (`audio_duration_s`), `error` (`code`,`is_fatal`,`message`).
- Close codes: 1003 rate/quota/bad key, 1008 inactivity (send pings), 1011 server error, 4000 invalid param/model.
- SDK: `async with AsyncSarvamAI(api_subscription_key=K).speech_to_text_realtime_streaming.connect(language_code="hi-IN", stream_type="fast") as ws:`
  `await ws.send_realtime_audio_input(RealtimeAudioInput(audio=b64))`, `await ws.send_realtime_end(RealtimeEnd())`, `async for msg in ws: msg.event`.

### 2b. Legacy streaming: `wss://api.sarvam.ai/speech-to-text/ws` (default `saaras:v4`)
- Query: `language-code` (hyphenated!), `model`, `mode`, `keyterms`, `sample_rate` (8000|16000), `vad_signals`, `flush_signal`, `high_vad_sensitivity`, `input_audio_codec`, many VAD frame params.
- Audio msg: `{"audio": {"data": "<b64>", "sample_rate": 16000, "encoding": "audio/wav"}}`. Responses: `{"type":"data","data":{...}}` and `{"type":"events","data":{"signal_type":"START_SPEECH|END_SPEECH"}}`. No partials; one final per utterance.
- Use the SDK (`client.speech_to_text_streaming.connect(...)`, `ws.transcribe(audio=b64, encoding="audio/wav", sample_rate=16000)`); raw message schema beyond the above **[UNVERIFIED]**.
- Practical pattern: Android sends short (<=30 s) utterances -> REST is simpler; use realtime WS only for live captions/barge-in.

## 3. Batch STT (files up to 2 h, up to 20 files/job, diarization)

All calls use `api-subscription-key`, JSON:
1. `POST /speech-to-text/job/v1` body `{"job_parameters": {"model":"saaras:v4","mode":"transcribe","language_code":"hi-IN|unknown","with_timestamps":false,"with_diarization":false,"num_speakers":2,"input_audio_codec":"..","keyterms":[..]}, "callback": {..optional}}` -> `{"job_id","job_state","storage_container_type",...}`
2. `POST /speech-to-text/job/v1/upload-files` `{"job_id","files":["a.wav"]}` -> `upload_urls` (presigned; PUT the bytes; required PUT headers e.g. Azure `x-ms-blob-type` **[UNVERIFIED]**)
3. `POST /speech-to-text/job/v1/{job_id}/start`
4. `GET /speech-to-text/job/v1/{job_id}/status` -> `job_state` in `Accepted|Pending|Running|Completed|Failed`, per-file `job_details[]`.
5. `POST /speech-to-text/job/v1/download-files` `{"job_id","files":[...]}` -> `download_urls`.
Poll no faster than 5 s (batch limit 20 req/min on Starter). SDK: `client.speech_to_text_job.create_job(...)`, `.upload_files()`, `.start()`, `.wait_until_complete()`, `.download_outputs()`. Same pattern at `/speech-to-text-translate/job/v1`. Not needed for field voice commands.

## 4. Text-to-Speech (Bulbul)

- `POST https://api.sarvam.ai/text-to-speech`, `application/json`. Model **`bulbul:v3`** (current), `bulbul:v2` legacy. Spec defaults (speaker, sample rate 22050) are v2-flavoured -> ALWAYS send `"model":"bulbul:v3"`.
- Body:

  | field | type | v3 notes |
  |---|---|---|
  | `text` | string, required | max **2500 chars** (v3), 1500 (v2). Native script for Indic words; commas in numbers >4 digits ("10,000"). No SSML |
  | `language_code` | enum, required | bn-IN en-IN gu-IN hi-IN kn-IN ml-IN mr-IN od-IN pa-IN ta-IN te-IN (only these 11) |
  | `speaker` | enum, default `shubh` | lowercase, case-sensitive |
  | `pace` | float, default 1 | v3: 0.5-2.0 |
  | `temperature` | float, default 0.6 | 0.01-1, v3 |
  | `speech_sample_rate` | int | 8000,16000,22050,24000 (v3 default 24000); 32000/44100/48000 REST + v3 only |
  | `output_audio_codec` | enum, default `wav` | mp3, linear16, mulaw, alaw, opus, flac, aac, wav |
  | `dict_id` | str | pronunciation dictionary id |
  | `pitch`, `loudness`, `enable_preprocessing` | | v2 only / NOT supported on v3 (v3 preprocessing always on). Do not send |
  | `output_audio_bitrate` | 32k,64k,96k,128k,192k | in `/text-to-speech/stream` spec; REST support **[UNVERIFIED]** |

- Speakers v3 (30+): male shubh(default) aditya rahul rohan amit dev ratan varun(dramatic, avoid) manan sumit kabir aayan ashutosh advait anand tarun sunny mani gokul vijay mohit rehan soham; female ritu priya neha pooja simran kavya ishita shreya roopa tanya shruti suhani kavitha rupali. v2 only: anushka manisha vidya arya abhilash karun hitesh.
- Response: `{"request_id": str, "audios": ["<base64>", ...]}`. `"".join(audios)` then base64-decode -> bytes (spec text says WAV; with `output_audio_codec` set, bytes are in that codec **[UNVERIFY container details]**).
- Other: `POST /text-to-speech/stream` (chunked binary, max 3500 chars, <=24 kHz); WebSocket `wss://api.sarvam.ai/text-to-speech/ws?model=bulbul:v3` (client msgs `{"type":"config","data":{speaker, language, codec, min_buffer_size, max_chunk_length}}`, `{"type":"text","data":{"text":".."}}`, `{"type":"flush"}`, `{"type":"ping"}`; base64 audio chunks come back; no cancel message; exact schema **[UNVERIFIED]**).
- Rate: Starter 30 req/min for v3 (60 for others), Pro 200, Business 1000. Price Rs 30 / 10K chars.
- For Android playback use `output_audio_codec="mp3"` (small) or `wav`, `speech_sample_rate=24000`.

```python
import base64, httpx
async def tts(text, lang="hi-IN", speaker="ishita", codec="mp3"):
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post("https://api.sarvam.ai/text-to-speech",
            headers={"api-subscription-key": KEY},
            json={"text": text[:2500], "language_code": lang, "speaker": speaker,
                  "model": "bulbul:v3", "pace": 1.0, "speech_sample_rate": 24000,
                  "output_audio_codec": codec})
        r.raise_for_status()
        return base64.b64decode("".join(r.json()["audios"]))
```
SDK: `client.text_to_speech.convert(text=..., language_code="hi-IN", model="bulbul:v3", speaker="shubh")` -> `.audios`.

## 5. Chat Completions

- **V1**: `POST https://api.sarvam.ai/v1/chat/completions`, models `sarvam-105b` (128K ctx; reasoning/agentic) and `sarvam-105b-conversations` (32K ctx; real-time dialogue/voice; V1 only).
- **V2 (beta, needs per-key whitelisting else 400)**: `POST /v2/chat/completions`, models `sarvam-105b`, `glm5.3`, `gemma4` (text+image), `deepseekv4-flash`; `GET /v2/models`; also `/v2/responses`. Model IDs case-sensitive.
- Deprecated/removed: `sarvam-m` (no longer served), `sarvam-30b` (deprecated). Do not use.
- Auth: `api-subscription-key` header OR `Authorization: Bearer <key>`.
- Body (OpenAI-compatible): `model`, `messages` (required), `temperature` 0-2 (default 0.2), `top_p`, `max_tokens` (default 2048), `stream` (SSE `chat.completion.chunk`; `delta.content`, `delta.reasoning_content`), `stop`, `n` 1-128, `seed`, `frequency_penalty`, `presence_penalty`, `tools`, `tool_choice` (`auto|none|required|{"type":"function","function":{"name":..}}`), `response_format` (`{"type":"json_object"}` or `{"type":"json_schema","json_schema":{"name":..,"strict":true,"schema":{..}}}`), `reasoning_effort` (`low|medium|high`, or `null` to disable).
- Reasoning gotcha: thinking is ON by default. Reasoning tokens count against `max_tokens`; a small value can yield `content: null`, `finish_reason:"length"`, only `reasoning_content`. For short/voice replies send `"reasoning_effort": null` and `max_tokens>=512`.
- Response: `{"id","object":"chat.completion","created","model","choices":[{"index","finish_reason":"stop|length|tool_calls|content_filter","message":{"role":"assistant","content":str|null,"reasoning_content":str|null,"tool_calls":[{"id","type":"function","function":{"name","arguments":"<json string>"}}]}}],"usage":{...}}`
- Tool calling: send `tools`; on `finish_reason=="tool_calls"` run the function, append the assistant msg + `{"role":"tool","tool_call_id":id,"content":"..."}`, call again. `parallel_tool_calls:false` is not enforced on sarvam-105b.
- Rate: 105B models 40 req/min Starter, 60 Pro, 120 Business. Price: Rs 29.28 / 1M input, Rs 10.98 cached input, Rs 73.2 / 1M output.

```python
async def chat(messages, model="sarvam-105b-conversations", json_schema=None):
    body = {"model": model, "messages": messages, "temperature": 0.2,
            "max_tokens": 1024, "reasoning_effort": None}
    if json_schema:
        body["response_format"] = {"type": "json_schema",
            "json_schema": {"name": "out", "strict": True, "schema": json_schema}}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post("https://api.sarvam.ai/v1/chat/completions",
                         headers={"api-subscription-key": KEY}, json=body)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
```
SDK: `client.chat.completions(model="sarvam-105b", messages=[...], reasoning_effort=None)`; V2: `client.chat.completions_v2(...)`.

## 6. Translate / Transliterate / Language ID (JSON, `api-subscription-key`)

- `POST /translate`: `input` (spec max 2000; Mayura effectively 1000, sarvam-translate 2000), `source_language_code` (`auto` or code), `target_language_code`, `model` (`mayura:v1` 11 langs | `sarvam-translate:v1` all 23, formal only), `mode` (`formal|modern-colloquial|classic-colloquial|code-mixed`, mayura only), `speaker_gender` (`Male|Female`), `output_script` (`roman|fully-native|spoken-form-in-native`), `numerals_format` (`international|native`). Response `{"request_id","translated_text","source_language_code"}`. Rs 20/10K chars; 60 req/min Starter.
- `POST /transliterate`: `input` (<=1000), `source_language_code` (`auto` + 11 langs), `target_language_code`, `numerals_format`, `spoken_form` (bool), `spoken_form_numerals_language` (`english|native`). Response `{"request_id","transliterated_text","source_language_code"}`. Rs 20/10K.
- `POST /text-lid`: `{"input": "..."}` -> `{"request_id","language_code":"hi-IN","script_code":"Deva|Latn|Taml|..."}`. Rs 3.5/10K.
- SDK: `client.text.translate(input=, source_language_code=, target_language_code=, model=, mode=)`; transliterate / LID: `client.text.transliterate(...)`, `client.text.identify_language(input=...)` **[method names UNVERIFIED for these two]**.

## 7. Document Intelligence (Sarvam Vision) - "Doc AI"

Namespace `/doc-ai/v1/job/*` (supersedes older `/doc-digitization/job/v1`, still supported). Model default `sarvam-vision-v1` (marketed as Sarvam Vision 1.5, 3B params).
- **Upload**: multipart directly in the create call (field `file`, repeatable). Alternative presigned flow: `POST /doc-ai/v1/job/upload {"content_type":"image/jpeg"}` -> `{upload_id, method, url, headers, expires_at}`; send the bytes with that method/headers (Content-Type must match), then pass `upload_ids="id1,id2"` instead of `file`. Exactly one of `file`/`upload_ids`.
- Formats: PDF (<=10 pages), PNG, JPG/JPEG, ZIP (flat, <=10 JPG/PNG). Size: model page says 200 MB/file, dashboard docs say 50 MB/file (stay <50 MB). >10 pages -> 400; 413 too large; 422 corrupt/invalid.
- **Extract**: `POST /doc-ai/v1/job/extract` multipart fields: `file`, `schema` (JSON **string**) XOR `config_id`, `language` (default `en-IN`; NOT `language_code`), `output_format` (`json` default|`csv`|`xlsx`), `classification` (`"true"|"false"`), `model`.
  Schema rules: root `{"type":"object","properties":{...}}` non-empty; every field needs `type` (string|number|integer|boolean|object|array) AND non-empty `description`; optional `enum`; objects need `properties`, arrays need `items`; max depth 4.
- **Digitise**: `POST /doc-ai/v1/job/digitise` multipart: `file`, `language`, `output_format` (`html` default|`md`|`json`; "markdown" -> 400), `content_type` (`printed` default|`handwritten`|`mixed`). Output is a ZIP via download-url.
- Create response: `{"job_id": "...", "status": "pending", ...}`.
- Poll `GET /doc-ai/v1/job/{job_id}/status` -> `{"job_id","status","pipeline","usage":{"pages_total","pages_processed","pages_succeeded","pages_failed"},"created_at","updated_at"}`.
  States: `pending`, `running`; terminal: `completed`, `partially_completed`, `failed`, `rejected` (compare lowercase). Limit 10 req/min on all plans -> poll every 5-6 s.
- Results `GET /doc-ai/v1/job/{job_id}/results` (409 before terminal). Extract shape: `{"job_id","type","status","usage","result":{...schema fields...},"annotations":{mirrors result; each leaf has "confidence" and "sources"},"version"}`. Exact annotation leaf layout and null-handling for missing fields **[UNVERIFIED]**.
- Download `GET /doc-ai/v1/job/{job_id}/download-url` -> `{"method":"GET","url","headers","expires_at"}` (digitise ZIP: primary file + `metadata/page_NNN.json` + `manifest.json`).
- Latency: single page "a few seconds" (docs); no SLA published. Rate 10 req/min. Price Rs 0.5/page (digitisation; separate extract price not listed **[UNVERIFIED]**), max 10 pages/job.
- SDK: `client.doc_ai.extract(file=[(name, fh, mime)], schema=json.dumps(s), language="en-IN", output_format="json")`, `.get_status(job_id=)`, `.get_results(job_id=)`, `.get_download_url(job_id=)`, `.digitise(...)`.

```python
import asyncio, json, httpx
SCHEMA = {"type": "object", "properties": {
  "name":     {"type": "string",  "description": "Full name of the person named on the document"},
  "age":      {"type": "integer", "description": "Age in years of that person"},
  "fir_no":   {"type": "string",  "description": "FIR number as printed, e.g. 123/2026"},
  "batch_no": {"type": "string",  "description": "Batch or lot number printed on the drug kit label"},
  "expiry":   {"type": "string",  "description": "Expiry date exactly as printed"}}}
TERMINAL = {"completed", "partially_completed", "failed", "rejected"}

async def extract_fields(jpg: bytes, filename="doc.jpg", lang="en-IN", schema=SCHEMA):
    hdr = {"api-subscription-key": KEY}
    async with httpx.AsyncClient(base_url="https://api.sarvam.ai", headers=hdr,
                                 timeout=httpx.Timeout(60, connect=10)) as c:
        r = await c.post("/doc-ai/v1/job/extract",
            files=[("file", (filename, jpg, "image/jpeg"))],
            data={"schema": json.dumps(schema), "language": lang, "output_format": "json"})
        r.raise_for_status(); job_id = r.json()["job_id"]
        for _ in range(40):                      # ~3.5 min cap
            await asyncio.sleep(5)
            st = (await c.get(f"/doc-ai/v1/job/{job_id}/status")).json()
            if st["status"].lower() in TERMINAL: break
        else:
            raise TimeoutError(job_id)
        if st["status"].lower() not in ("completed", "partially_completed"):
            raise RuntimeError(f"doc-ai {st['status']}: {st}")
        res = (await c.get(f"/doc-ai/v1/job/{job_id}/results")).json()
        return res["result"], res.get("annotations")   # {"name":..,"age":..,"fir_no":..,...}
```
Notes: use `language="hi-IN"` for Hindi FIRs (mixed-script behaviour **[UNVERIFIED]**). Validate every field server-side; treat as assistive, not authoritative evidence.

## 8. Pricing / credits / free tier

- Free: Rs 100 credits at signup, universal, never expire. Plans: Starter (pay-as-you-go), Pro Rs 10,000, Business Rs 50,000, Enterprise custom. Credits exhausted -> 429 `insufficient_quota_error`.
- Rates: STT Rs 30/h (Rs 45 diarized), Bulbul v3 Rs 30/10K chars, Translate Rs 20/10K chars, LID Rs 3.5/10K, Doc digitisation Rs 0.5/page, Chat 105B Rs 29.28 / 73.2 per 1M in/out tokens.
- Rate limits (Starter): STT REST 60/min, TTS v3 30/min, chat-105B 40/min, translate 60/min, Doc AI 10/min (all plans), Vision realtime 30/min. Per account, token-bucket. Recheck `docs.sarvam.ai/api/getting-started/pricing` and `/ratelimits` before budgeting. Commercial use of generated audio: see the Commercial Licensing page.

## 9. Errors in `SIHH/sarvam_voice/sarvam_client.py`

Base URL, auth header, and the five endpoint paths are right; details are stale or wrong:
1. **Session default `Content-Type: application/json`** (constructor) is merged into multipart requests (STT, Doc AI), so requests keeps the JSON type and the multipart boundary is lost -> 4xx. Do not set it on the session; use `json=` per call.
2. **`timeout=5`** default is too short for STT (up to 30 s audio), chat (105B, reasoning), Doc AI. Use 30-60 s.
3. **STT model `saaras:v2`** is invalid; valid ids are `saaras:v4` / `saaras:v3`. `mode` never sent. Hardcodes `audio.wav`/`audio/wav`. No `unknown` auto-detect. No 30 s guard. Real response has no `confidence`/`duration_sec` (mock invents them, so code relying on them breaks live).
4. **TTS body is old-style**: sends `"inputs": [text]` (now `text`: string) and `"target_language_code"` (now `language_code`). Sends `pitch`, `loudness: 1.5`, `enable_preprocessing`, unsupported on bulbul:v3 (422 vs ignored **[UNVERIFIED]**). No `output_audio_codec`. Fallback speaker `"meera"` is a retired voice; `anushka` etc. are v2-only; names must be lowercase.
5. **Doc AI treated as synchronous**: expects a 200 with the fields. Real API returns `{job_id,status:"pending"}`; you must poll `/status`, then GET `/results`. Fields are under `result`, confidences under `annotations`.
6. **Doc AI schema format wrong**: sends `{"reagent_name":"string","witnesses":"list of strings"}`. Required: `{"type":"object","properties":{f:{"type":..,"description":..}}}` with non-empty `description` per field and `items` for arrays. Also mime hardcoded `image/jpeg`, no `language`.
7. **Chat**: no `reasoning_effort` control (default thinking can eat `max_tokens=1000` -> empty `content`); ignores `finish_reason`/`reasoning_content`; no `response_format`/`tools` use. Model default `sarvam-105b-conversations` is valid (32K ctx).
8. **Silent mock fallback on ANY failure** (non-200, timeout, bad key) returns fabricated transcripts and fake seizure/kit data (e.g. "Gurpreet Singh", Aadhaar, `VALID_FOR_FIELD_USE`) with only a `_simulated` flag. Dangerous in a police evidence app: raise/502 in production and gate mock behind an explicit dev flag. `is_mock` also triggers when the key is <= 8 chars.
9. `requests` is blocking inside async FastAPI routes -> use `httpx.AsyncClient` or `AsyncSarvamAI`.
10. `_resolve_audio_bytes` treats any non-path string as base64, or else encodes the string itself as "audio" bytes; sends garbage instead of erroring.
11. `translate`: fields fine for `mayura:v1`, but no `source_language_code="auto"`, no chunking at Mayura's 1000-char cap, only 11 languages (use `sarvam-translate:v1` for others). Mock returns fake `"[Hindi] text"`.
12. No retry/backoff for 429/503, no error-body parsing, and 403 (auth) is not distinguished from other failures.
