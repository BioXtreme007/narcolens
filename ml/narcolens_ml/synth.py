"""
Synthetic spot-plate photos for bootstrapping the well classifier.

This is NOT a substitute for real kit photos. It exists so the full pipeline
(detect wells -> extract colour -> classify) can be built, tested and measured
today, and simply retrained once real labelled photos arrive (see train.py --real).

What it varies, because each one breaks naive colour reading in the field:
  * illuminant (daylight, tungsten, sodium street lamp, cool LED, fluorescent)
  * phone auto-white-balance strength, exposure, gamma
  * shadows, flash glare, blur, sensor noise, JPEG compression
  * plate position / size / rotation, table background
  * reaction strength: full positives, weak/ambiguous reactions (-> "unclear")
Sessions share lighting + camera, so train/test can be split by session
(random splits overestimate accuracy on new conditions — chemrxiv-2021-0zbwm).
"""
from dataclasses import dataclass, field

import cv2
import numpy as np

from .color import delta_e2000, hex_to_rgb, lab_to_rgb, rgb_to_lab
from .reagents import NEG, PRESETS, REAGENTS, UNCLEAR, classes

W, H = 480, 640

ILLUMINANTS = {
    "daylight": (1.00, 1.00, 1.00),
    "overcast": (0.94, 0.98, 1.06),
    "tungsten": (1.00, 0.80, 0.58),
    "sodium":   (1.00, 0.70, 0.32),
    "led_cool": (0.88, 0.96, 1.10),
    "fluoro":   (0.94, 1.03, 0.88),
}


@dataclass
class Session:
    illum: np.ndarray
    illum_name: str
    awb: float
    exposure: float
    gamma: float
    noise: float
    blur: float
    jpeg: int
    table: np.ndarray
    seed: int = 0
    ccm: np.ndarray = None          # phone sensor colour crosstalk (3x3)
    sat: float = 1.0                # phone "vivid" saturation boost
    tone: float = 0.0               # S-curve strength
    vignette: float = 0.0


@dataclass
class Well:
    cx: float
    cy: float
    r: float
    reagent: str
    label: str
    true_rgb: np.ndarray = field(default=None)


def cct_rgb(k):
    """Approximate linear-RGB white of a blackbody at k kelvin (Tanner Helland fit), normalised to G=1."""
    t = k / 100.0
    r = 255 if t <= 66 else 329.7 * (t - 60) ** -0.1332
    g = 99.47 * np.log(t) - 161.1 if t <= 66 else 288.1 * (t - 60) ** -0.0755
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5 * np.log(t - 10) - 305.0)
    c = np.clip(np.array([r, g, b]), 1, 255) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return c / c[1]


def random_session(rng) -> Session:
    if rng.random() < 0.55:                                   # continuous blackbody light, 2000–7500 K
        k = float(rng.uniform(2000, 7500)); name = f"cct{int(k)}"
        illum = cct_rgb(k) * rng.normal(1, 0.02, 3)
        if rng.random() < 0.25:                               # fluorescent / LED green-magenta tint
            illum *= np.array([1, rng.uniform(0.94, 1.08), 1])
    else:
        name = rng.choice(list(ILLUMINANTS))
        illum = np.array(ILLUMINANTS[name]) * rng.normal(1, 0.03, 3)
    return Session(
        illum=illum, illum_name=name,
        awb=float(rng.uniform(0.0, 0.9)), exposure=float(rng.uniform(0.6, 1.2)),
        gamma=float(rng.uniform(0.9, 1.1)), noise=float(rng.uniform(1.5, 8)),
        blur=float(rng.choice([0, 0, rng.uniform(0.4, 1.6)])), jpeg=int(rng.integers(55, 96)),
        table=rng.uniform([40, 30, 20], [150, 130, 115]), seed=int(rng.integers(1 << 30)),
        ccm=_random_ccm(rng), sat=float(rng.uniform(0.9, 1.35)), tone=float(rng.uniform(0, 0.35)),
        vignette=float(rng.uniform(0, 0.35)))


def _random_ccm(rng):
    """Rows sum to 1: mixes channels like a different phone sensor + ISP would."""
    m = np.eye(3) + rng.normal(0, 0.06, (3, 3))
    return m / m.sum(1, keepdims=True)


def _mix_lab(a_hex, b_hex, t):
    la, lb = rgb_to_lab(hex_to_rgb(a_hex)), rgb_to_lab(hex_to_rgb(b_hex))
    return la + (lb - la) * t


def sample_reaction(reagent_id, label, rng) -> np.ndarray:
    """Return the true (daylight) sRGB colour of a well for a given class."""
    R = REAGENTS[reagent_id]
    base = R["baseline"]
    if label == NEG:
        lab = rgb_to_lab(hex_to_rgb(base)) + rng.normal(0, [3, 2.5, 2.5])
    elif label == UNCLEAR:
        outcomes = R["outcomes"]
        if rng.random() < 0.7:                       # weak / partial reaction
            o = outcomes[rng.integers(len(outcomes))]
            lab = _mix_lab(base, o["hex"], rng.uniform(0.28, 0.55)) + rng.normal(0, [3, 3, 3])
        else:                                        # off-colour: matches nothing in the chart
            refs = [rgb_to_lab(hex_to_rgb(base))] + [rgb_to_lab(hex_to_rgb(o["hex"])) for o in outcomes]
            for _ in range(50):
                lab = np.array([rng.uniform(30, 75), rng.uniform(-10, 25), rng.uniform(0, 35)])
                if min(float(delta_e2000(lab, r)) for r in refs) > 18:
                    break
    else:
        opts = [o for o in R["outcomes"] if o["drug"] == label]
        o = opts[rng.integers(len(opts))]
        lab = _mix_lab(base, o["hex"], rng.uniform(0.8, 1.0)) + rng.normal(0, [6, 6, 6])   # wide: real shade unknown
    return lab_to_rgb(lab)


def _srgb_to_lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055) * 255


def render_plate(sess: Session, rng, reagent_ids=None, labels=None):
    """Render one photo. Returns (uint8 RGB image HxWx3, [Well,...])."""
    if reagent_ids is None:
        preset = PRESETS[rng.integers(len(PRESETS))]
        reagent_ids = list(preset["wells"]) if rng.random() < 0.7 else list(rng.choice(list(REAGENTS), 3))
    if labels is None:
        labels = []
        for rid in reagent_ids:
            cl = classes(rid)
            u = rng.random()
            if u < 0.40:
                labels.append(NEG)
            elif u < 0.80:
                labels.append(cl[1 + rng.integers(len(cl) - 2)])
            else:
                labels.append(UNCLEAR)

    img = np.empty((H, W, 3), np.float64)
    img[:] = sess.table + rng.normal(0, 6, 3)
    img += rng.normal(0, 7, (H, W, 1)) * (rng.random() < 0.5)            # cloth / wood grain
    img = cv2.GaussianBlur(img, (0, 0), 3)

    # plate
    pw = W * rng.uniform(0.70, 0.92)
    ph = pw * rng.uniform(0.30, 0.40)
    cx, cy = W / 2 + rng.uniform(-30, 30), H / 2 + rng.uniform(-90, 90)
    ang = rng.uniform(-12, 12)
    tone = np.array([245, 245, 240]) + rng.normal(0, 3, 3)
    plate = cv2.boxPoints(((cx, cy), (pw, ph), ang)).astype(np.int32)
    shadow = img.copy()
    cv2.fillPoly(shadow, [plate + np.array([6, 10])], (20, 20, 20))
    img = cv2.addWeighted(shadow, 0.35, img, 0.65, 0)
    cv2.fillPoly(img, [plate], tone.tolist(), lineType=cv2.LINE_AA)

    # wells along the plate's long axis
    ux, uy = np.cos(np.radians(ang)), np.sin(np.radians(ang))
    r = ph * rng.uniform(0.26, 0.32)
    spacing = pw * rng.uniform(0.28, 0.31)
    wells = []
    for i, (rid, lab) in enumerate(zip(reagent_ids, labels)):
        k = i - 1
        wx, wy = cx + ux * spacing * k, cy + uy * spacing * k
        col = sample_reaction(rid, lab, rng)
        cv2.circle(img, (int(wx), int(wy + 2)), int(r * 1.08), (tone * 0.86).tolist(), -1, cv2.LINE_AA)  # recess rim
        y0, y1 = int(max(0, wy - r - 2)), int(min(H, wy + r + 3))
        x0, x1 = int(max(0, wx - r - 2)), int(min(W, wx + r + 3))
        yy, xx = np.ogrid[y0:y1, x0:x1]
        d = np.sqrt((xx - wx) ** 2 + (yy - wy) ** 2) / r
        m = d <= 1
        shade = 1.04 - 0.14 * d ** 2                                        # meniscus darkening to the edge
        sub = img[y0:y1, x0:x1]
        sub[m] = (col[None, :] * shade[m][:, None])
        if rng.random() < 0.5:                                              # small specular highlight
            cv2.ellipse(img, (int(wx - r * .42), int(wy - r * .45)), (int(r * .14), int(r * .07)), -35, 0, 360, (255, 255, 255), -1, cv2.LINE_AA)
        wells.append(Well(wx, wy, r, rid, lab, col))

    # lighting: shadows, glare, illuminant, camera AWB, exposure
    lin = _srgb_to_lin(img)
    if rng.random() < 0.4:
        gx, gy = rng.normal(0, 1, 2)
        yy, xx = np.mgrid[:H, :W]
        g = (xx / W - 0.5) * gx + (yy / H - 0.5) * gy
        lin *= (1 - rng.uniform(0.15, 0.45) * (g - g.min()) / (np.ptp(g) + 1e-9))[..., None]
    if rng.random() < 0.2:
        gxy = (int(rng.uniform(0.2, 0.8) * W), int(cy + rng.uniform(-ph / 2, ph / 2)))
        blob = np.zeros((H, W), np.float64)
        cv2.circle(blob, gxy, int(rng.uniform(25, 60)), 1.0, -1)
        blob = cv2.GaussianBlur(blob, (0, 0), 18)
        lin += blob[..., None] * rng.uniform(0.3, 0.8)
    lin *= sess.illum[None, None, :]
    est = sess.illum / sess.illum.mean()                                    # phone AWB partly undoes the cast
    lin /= est ** sess.awb
    lin *= sess.exposure * rng.normal(1, 0.04)
    lin = np.clip(lin @ sess.ccm.T, 0, None)                               # sensor crosstalk
    if sess.vignette > 0:
        yy, xx = np.mgrid[:H, :W]
        rr = ((xx - W / 2) ** 2 + (yy - H / 2) ** 2) / ((W / 2) ** 2 + (H / 2) ** 2)
        lin *= (1 - sess.vignette * rr)[..., None]
    out = _lin_to_srgb(lin) / 255.0
    if sess.tone > 0:                                                        # phone tone curve (S-curve)
        out = out + sess.tone * (out - 0.5) * (1 - np.abs(2 * out - 1))
    if sess.sat != 1:                                                        # "vivid" colour boost
        grey = out.mean(-1, keepdims=True)
        out = grey + (out - grey) * sess.sat
    out = 255 * np.clip(out, 0, 1) ** sess.gamma
    out += rng.normal(0, sess.noise, out.shape)
    if sess.blur > 0:
        out = cv2.GaussianBlur(out, (0, 0), sess.blur)
    out = np.clip(out, 0, 255).astype(np.uint8)
    ok, enc = cv2.imencode(".jpg", cv2.cvtColor(out, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, sess.jpeg])
    out = cv2.cvtColor(cv2.imdecode(enc, cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)
    return out, wells
