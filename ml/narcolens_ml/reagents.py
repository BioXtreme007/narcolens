"""Reagent table (shared with the app) and the coarse per-well label set."""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "reagents.json"
_raw = json.loads(DATA.read_text(encoding="utf-8"))
REAGENTS = _raw["reagents"]
PRESETS = _raw["presets"]

NEG, UNCLEAR = "negative", "unclear"


def classes(reagent_id: str) -> list:
    """Coarse classes per well: negative, one class per distinct drug, unclear.
    (Coarse beats fine-grained on new lighting/cameras — chemrxiv-2021-0zbwm, Table 2.)"""
    drugs = []
    for o in REAGENTS[reagent_id]["outcomes"]:
        if o["drug"] not in drugs:
            drugs.append(o["drug"])
    return [NEG] + drugs + [UNCLEAR]
