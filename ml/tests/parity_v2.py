"""Dump v2 feature vectors and labels for the phone engine to match.

Uses the shipped wells-v2.json head (temperature + Mahalanobis), not a retrain.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from narcolens_ml.color import hex_to_rgb
from narcolens_ml.features import well_features
from narcolens_ml.reagents import REAGENTS

ROOT = Path(__file__).resolve().parents[1]
MODEL = json.loads((ROOT / "models" / "narcolens-wells-v2.json").read_text(encoding="utf-8"))


def predict(rid: str, x: np.ndarray) -> tuple[str, float]:
    m = MODEL["reagents"][rid]
    z = (x - np.array(m["mean"])) / np.array(m["std"])
    logits = (np.array(m["W"]) @ z + np.array(m["b"])) / m["T"]
    logits = logits - logits.max()
    p = np.exp(logits)
    p = p / p.sum()
    k = int(p.argmax())
    label = m["classes"][k]
    if p[k] < MODEL["unclear_below"]:
        label = "unclear"
    best = 1e18
    for mu, prec in zip(m["ood"]["centres"], m["ood"]["precisions"]):
        d = z - np.array(mu)
        best = min(best, float(d @ np.array(prec) @ d))
    dist = float(np.sqrt(max(best, 0.0)))
    if dist > m["ood"]["thr"] and label != "unclear":
        label = "unclear"
    return label, float(p[k])


def main() -> None:
    white = np.array([246.0, 246.0, 246.0])
    cases = []
    for rid, reagent in REAGENTS.items():
        colours = [("baseline", reagent["baseline"])] + [(o["drug"], o["hex"]) for o in reagent["outcomes"]]
        colours.append(("odd", "#33CCFF"))
        for name, hx in colours:
            rgb = hex_to_rgb(hx)
            feat = well_features(rid, rgb, white, {"spread_L": 0.0, "spread_ab": 0.0})
            label, p = predict(rid, feat)
            cases.append(
                {
                    "id": rid,
                    "name": name,
                    "hex": hx,
                    "label": label,
                    "p": round(p, 4),
                    "feat": [round(float(v), 4) for v in feat],
                }
            )
    print(json.dumps(cases))


if __name__ == "__main__":
    main()
