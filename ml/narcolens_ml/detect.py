"""
Find the 3 wells on a spot-plate photo.

1. Plate: the largest bright, low-saturation blob (Otsu on a whiteness score).
2. Prior: 3 wells evenly spaced along the plate's long axis (kit layout).
3. Refine: snap each prior to the nearest Hough circle, if one is close.
Returns [(cx, cy, r), ...] ordered along the plate, or None if no plate is found.
"""
import cv2
import numpy as np


def find_plate(rgb):
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    s, v = hsv[..., 1].astype(np.float32), hsv[..., 2].astype(np.float32)
    white = np.clip(v - 0.8 * s, 0, 255).astype(np.uint8)
    white = cv2.GaussianBlur(white, (0, 0), 3)
    _, m = cv2.threshold(white, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return None
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < 0.03 * rgb.shape[0] * rgb.shape[1]:
        return None
    # fill holes so coloured wells don't shrink the plate
    hull = cv2.convexHull(c)
    return cv2.minAreaRect(hull)


def refine_local(rgb, px, py, r, steps=4, span=0.45):
    """Cheap, Hough-free refinement (also runs on the phone): search a small grid around the prior for the
    centre where the disk is most uniform and most different from the surrounding ring."""
    H, W = rgb.shape[:2]
    img = rgb.astype(np.float32)
    ang = np.linspace(0, 2 * np.pi, 24, endpoint=False)
    best = (-1e9, px, py)
    for dy in np.linspace(-span, span, 2 * steps + 1):
        for dx in np.linspace(-span, span, 2 * steps + 1):
            cx, cy = px + dx * r, py + dy * r
            pts_in = [(cx + r * f * np.cos(a), cy + r * f * np.sin(a)) for f in (0.2, 0.45, 0.7) for a in ang[::2]] + [(cx, cy)]
            pts_out = [(cx + r * 1.3 * np.cos(a), cy + r * 1.3 * np.sin(a)) for a in ang]
            def px_(pts):
                return np.array([img[int(np.clip(y, 0, H - 1)), int(np.clip(x, 0, W - 1))] for x, y in pts])
            a, b = px_(pts_in), px_(pts_out)
            score = np.linalg.norm(np.median(a, 0) - np.median(b, 0)) - 0.8 * a.std(0).mean()
            if score > best[0]:
                best = (score, cx, cy)
    return best[1], best[2]


def detect_wells(rgb, n=3, use_hough=True):
    rect = find_plate(rgb)
    if rect is None:
        return None
    (cx, cy), (w, h), ang = rect
    if w < h:                       # make the long side "w"
        w, h, ang = h, w, ang + 90
    ux, uy = np.cos(np.radians(ang)), np.sin(np.radians(ang))
    r0 = h * 0.29
    spacing = w * 0.295
    priors = [(cx + ux * spacing * k, cy + uy * spacing * k) for k in range(-(n // 2), n // 2 + 1)][:n]

    if not use_hough:
        return [(*refine_local(rgb, px, py, r0), r0) for px, py in priors]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (0, 0), 1.5)
    circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, dp=1.2, minDist=r0 * 1.5, param1=90, param2=16,
                               minRadius=int(r0 * 0.7), maxRadius=int(r0 * 1.35))
    found = [] if circles is None else circles[0].tolist()
    out = []
    for px, py in priors:
        best = None
        for (x, y, r) in found:
            d = np.hypot(x - px, y - py)
            if d < r0 * 0.6 and (best is None or d < best[0]):
                best = (d, x, y, r)
        out.append((best[1], best[2], best[3]) if best else (px, py, r0))
    return out
