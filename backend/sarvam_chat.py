import os
from pathlib import Path

from sarvamai import SarvamAI

env_path = Path(__file__).with_name(".env")
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

api_key = os.environ.get("SARVAM_API_KEY", "").strip()
if not api_key:
    raise SystemExit("SARVAM_API_KEY is empty. Paste your key into .env and run this again.")

client = SarvamAI(api_subscription_key=api_key)
response = client.chat.completions(
    model="sarvam-105b-conversations",
    messages=[{"role": "user", "content": "Reply with one short sentence."}],
    reasoning_effort=None,
    max_tokens=512,
)
print(response.choices[0].message.content)
