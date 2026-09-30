"""
Per-well colour features.  The SAME recipe is re-implemented in the app (TypeScript)
and the prototype (JS) — keep FEATURE_NAMES in sync with ml/models/*.json.

Reference: the white plate ring around each well (1.3r–1.9r) is imaged under the
same light, so dividing by it cancels most of the illuminant + camera white balance.
"""
import numpy as np

from .color import delta_e2000, hex_to_rgb, rgb_to_hsv, rgb_to_lab
from .reagents import REAGENTS

WHITE_TARGET = 246.0


def sample_well(rgb, cx, cy, r, return_stats=False):
    """Median well colour (glare removed), plate-white reference around it,
    and (optionally) stats: colour spread inside the well + glare fraction."""
    H, W = rgb.shape[:2]
    R2 = r * 1.9
    x0, x1 = int(max(0, cx - R2)), int(min(W, cx + R2 + 1))
    y0, y1 = int(max(0, cy - R2)), int(min(H, cy + R2 + 1))
    patch = rgb[y0:y1, x0:x1].reshape(-1, 3).astype(np.float64)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    d = np.hypot(xx - cx, yy - cy).ravel()
    inner_all = patch[d <= r * 0.65]
    glare = np.all(inner_all > 245, axis=1) if len(inner_all) else np.zeros(0, bool)
    inner = inner_all[~glare]                                                 # drop specular glare
    if len(inner) < 10:
        inner = inner_all
    ring = patch[(d >= r * 1.3) & (d <= r * 1.9)]
    if len(ring) < 10:
        ring = patch
    lum = ring.sum(1)
    ring = ring[lum >= np.median(lum)]                                        # plate, not table/shadow
    well, white = np.median(inner, 0), np.median(ring, 0)
    if not return_stats:
        return well, white
    corr = np.clip(inner * (WHITE_TARGET / np.maximum(white, 30)), 0, 255)
    lab = rgb_to_lab(corr)
    stats = {"spread_L": float(np.std(lab[:, 0])), "spread_ab": float(np.hypot(np.std(lab[:, 1]), np.std(lab[:, 2]))),
             "glare": float(glare.mean()) if len(glare) else 0.0}
    return well, white, stats


def reagent_refs(reagent_id):
    R = REAGENTS[reagent_id]
    drugs = []
    for o in R["outcomes"]:
        if o["drug"] not in drugs:
            drugs.append(o["drug"])
    base = rgb_to_lab(hex_to_rgb(R["baseline"]))
    per_drug = [np.array([rgb_to_lab(hex_to_rgb(o["hex"])) for o in R["outcomes"] if o["drug"] == d]) for d in drugs]
    return base, per_drug


FEATURE_NAMES = ["L", "a", "b", "chroma", "hue_cos_s", "hue_sin_s", "sat", "val",
                 "white_L", "white_a", "white_b", "raw_L", "dE_base", "dE_drug1", "dE_drug2", "dE_drug3",
                 "spread_L", "spread_ab"]


def well_features(reagent_id, well_rgb, white_rgb, stats=None):
    corr = np.clip(well_rgb * (WHITE_TARGET / np.maximum(white_rgb, 30)), 0, 255)
    lab = rgb_to_lab(corr)
    hsv = rgb_to_hsv(corr)
    hr = np.radians(hsv[0])
    wlab = rgb_to_lab(white_rgb)
    raw = rgb_to_lab(well_rgb)
    base, per_drug = reagent_refs(reagent_id)
    dE = [float(delta_e2000(lab, base))]
    for refs in per_drug:
        dE.append(float(np.min(delta_e2000(lab[None, :], refs))))
    dE = (dE + [100.0, 100.0, 100.0])[:4]                                     # fixed width, pad unused drugs
    return np.array([lab[0], lab[1], lab[2], np.hypot(lab[1], lab[2]),
                     np.cos(hr) * hsv[1], np.sin(hr) * hsv[1], hsv[1], hsv[2],
                     wlab[0], wlab[1], wlab[2], raw[0], *dE,
                     (stats or {}).get("spread_L", 0.0), (stats or {}).get("spread_ab", 0.0)])


def photo_quality(rgb, circles, whites, glare_fracs):
    """Reasons to ask for a retake (empty list = photo is fine)."""
    import cv2
    issues = []
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    xs = [c[0] for c in circles]; ys = [c[1] for c in circles]; r = float(np.mean([c[2] for c in circles]))
    x0, x1 = int(max(0, min(xs) - 2 * r)), int(min(rgb.shape[1], max(xs) + 2 * r))
    y0, y1 = int(max(0, min(ys) - 2 * r)), int(min(rgb.shape[0], max(ys) + 2 * r))
    sharp = cv2.Laplacian(gray[y0:y1, x0:x1], cv2.CV_64F).var() * (r / 60.0) ** 2   # scale-normalised
    wl = rgb_to_lab(np.array(whites))[:, 0]
    if sharp < 25: issues.append("blurry")
    if np.min(wl) < 45: issues.append("too_dark")
    if np.mean(np.array(whites) >= 252) > 0.5: issues.append("overexposed")
    if max(glare_fracs) > 0.25: issues.append("glare")
    return issues
