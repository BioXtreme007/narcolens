"""
Train the NarcoLens per-well classifier (model v2).

  python train.py                          # synthetic bootstrap data
  python train.py --real data/real         # + real labelled photos (see README.md, "Real data")

Pipeline per photo: detect wells -> plate-referenced colour features -> per-reagent model.
Model per reagent = softmax (logistic regression) + temperature calibration
                    + Mahalanobis out-of-distribution check ("this colour isn't in the chart" -> unclear).
Split is BY SESSION (lighting + phone), never random, so scores reflect new conditions.
"""
import argparse
import csv
import json
import os
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from sklearn.covariance import LedoitWolf
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.preprocessing import StandardScaler

from narcolens_ml.color import lab_to_rgb
from narcolens_ml.detect import detect_wells
from narcolens_ml.features import FEATURE_NAMES, photo_quality, sample_well, well_features
from narcolens_ml.reagents import NEG, REAGENTS, UNCLEAR, classes
from narcolens_ml.synth import random_session, render_plate

HERE = Path(__file__).parent
UNCLEAR_BELOW = 0.60      # calibrated confidence under this -> unclear
OOD_PCTL = 99.5           # Mahalanobis threshold = this percentile of training distances


def featurize(img, circles, reagents):
    feats, whites, glare = [], [], []
    for rid, (x, y, r) in zip(reagents, circles):
        well_rgb, white, st = sample_well(img, x, y, r, return_stats=True)
        feats.append(well_features(rid, well_rgb, white, st)); whites.append(white); glare.append(st["glare"])
    return feats, photo_quality(img, circles, whites, glare)


def run_session(args):
    sid, n_plates, seed = args
    rng = np.random.default_rng(seed)
    sess = random_session(rng)
    rows, det_err, det_fail, qual = [], [], 0, []
    for _ in range(n_plates):
        img, wells = render_plate(sess, rng)
        det = detect_wells(img)
        if det is None:
            det_fail += 1
            det = [(w.cx, w.cy, w.r) for w in wells]
        for w, (x, y, r) in zip(wells, det):
            det_err.append(float(np.hypot(w.cx - x, w.cy - y) / w.r))
        feats, issues = featurize(img, det, [w.reagent for w in wells])
        qual.append(issues)
        rows += [(sid, sess.illum_name, w.reagent, w.label, f) for w, f in zip(wells, feats)]
    return rows, det_err, det_fail, qual


def load_real(root):
    """data/real/<session>/labels.csv: photo,reagent1,label1,reagent2,label2,reagent3,label3
    One <session> folder = one place/light/phone. Labels: negative | unclear | drug name from reagents.json."""
    rows, n = [], 0
    for sess_dir in sorted(p for p in Path(root).iterdir() if p.is_dir()):
        lab = sess_dir / "labels.csv"
        if not lab.exists():
            continue
        for rec in csv.DictReader(lab.open(encoding="utf-8")):
            img = cv2.imread(str(sess_dir / rec["photo"]))
            if img is None:
                print("  skip unreadable", rec["photo"]); continue
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            s = 900 / max(img.shape[:2])
            if s < 1:
                img = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
            det = detect_wells(img)
            if det is None:
                print("  no plate found in", rec["photo"]); continue
            rids = [rec[f"reagent{i}"] for i in (1, 2, 3)]
            labels = [rec[f"label{i}"] for i in (1, 2, 3)]
            if any(r not in REAGENTS or l not in classes(r) for r, l in zip(rids, labels)):
                print("  bad label in", rec["photo"]); continue
            feats, _ = featurize(img, det, rids)
            rows += [("real-" + sess_dir.name, "real", r, l, f) for r, l, f in zip(rids, labels, feats)]
            n += 1
    print(f"loaded {n} real photos / {len(rows)} wells from {root}")
    return rows


def rule_predict(reagent_id, X):
    """The original CIEDE2000 rule, kept as the baseline to beat."""
    cl = classes(reagent_id)
    out = []
    for f in X:
        dE_base, dE = f[12], f[13:13 + len(cl) - 2]
        k = int(np.argmin(dE))
        out.append(cl[1 + k] if dE[k] <= 10 and dE[k] < dE_base else NEG if dE_base <= 12 else UNCLEAR)
    return np.array(out)


def safety(y_true, y_pred):
    """missed = drug present but called negative; false_alarm = clean sample called a drug."""
    drug_t = (y_true != NEG) & (y_true != UNCLEAR)
    drug_p = (y_pred != NEG) & (y_pred != UNCLEAR)
    missed = float(np.mean(y_pred[drug_t] == NEG)) if drug_t.any() else 0.0
    false_alarm = float(np.mean(drug_p[y_true == NEG])) if (y_true == NEG).any() else 0.0
    wrong_drug = float(np.mean((y_pred[drug_t] != y_true[drug_t]) & drug_p[drug_t])) if drug_t.any() else 0.0
    return missed, false_alarm, wrong_drug


def softmax(z):
    z = z - z.max(1, keepdims=True); e = np.exp(z); return e / e.sum(1, keepdims=True)


def fit_temperature(logits, y):
    """Temperature scaling (Guo et al. 2017): 1 parameter, minimise NLL on held-out data."""
    best = (1e9, 1.0)
    for T in np.linspace(0.3, 6, 115):
        p = softmax(logits / T)
        nll = -np.mean(np.log(p[np.arange(len(y)), y] + 1e-12))
        best = min(best, (nll, T))
    return float(best[1])


def ece(p, y, bins=10):
    """Expected calibration error: does '80% sure' mean right 80% of the time?"""
    conf, pred = p.max(1), p.argmax(1)
    e = 0.0
    for lo in np.linspace(0, 1, bins, endpoint=False):
        m = (conf > lo) & (conf <= lo + 1 / bins)
        if m.any():
            e += m.mean() * abs((pred[m] == y[m]).mean() - conf[m].mean())
    return float(e)


class WellModel:
    def __init__(self, cl):
        self.cl = np.array(cl)

    def fit(self, X, yi, X_cal, yi_cal):
        self.sc = StandardScaler().fit(X)
        Z = self.sc.transform(X)
        self.lr = LogisticRegression(max_iter=4000, C=2.0).fit(Z, yi)
        self.T = fit_temperature(self.lr.decision_function(self.sc.transform(X_cal)), np.searchsorted(self.lr.classes_, yi_cal))
        # out-of-distribution: shrunk covariance per known (non-unclear) class
        self.ood = []
        for k in self.lr.classes_:
            if self.cl[k] == UNCLEAR:
                continue
            lw = LedoitWolf().fit(Z[yi == k])
            self.ood.append((k, lw.location_, lw.precision_))
        self.ood_thr = float(np.percentile(self.mahal(Z[self.cl[yi] != UNCLEAR]), OOD_PCTL))
        return self

    def mahal(self, Z):
        ds = [np.einsum("ij,jk,ik->i", Z - mu, P, Z - mu) for _, mu, P in self.ood]
        return np.sqrt(np.maximum(np.min(ds, 0), 0))

    def proba(self, X):
        Z = self.sc.transform(X)
        return softmax(self.lr.decision_function(Z) / self.T), self.mahal(Z)

    def predict(self, X):
        p, d = self.proba(X)
        lab = self.cl[self.lr.classes_[p.argmax(1)]]
        # unclear if not confident, or if the colour is far from every known class (and not already "unclear")
        return np.where((p.max(1) < UNCLEAR_BELOW) | ((d > self.ood_thr) & (lab != UNCLEAR)), UNCLEAR, lab), p, d

    def export(self):
        return {"classes": [str(self.cl[k]) for k in self.lr.classes_],
                "mean": self.sc.mean_.round(6).tolist(), "std": self.sc.scale_.round(6).tolist(),
                "W": self.lr.coef_.round(5).tolist(), "b": self.lr.intercept_.round(5).tolist(), "T": round(self.T, 4),
                "ood": {"thr": round(self.ood_thr, 4),
                        "centres": [mu.round(4).tolist() for _, mu, _ in self.ood],
                        "precisions": [P.round(4).tolist() for _, _, P in self.ood]},
                "kind": "softmax+T+mahalanobis"}


def ood_probe(rid, model, rng, n=300):
    """Colours that match nothing in the chart (e.g. an unknown new drug). They should come out 'unclear'."""
    from narcolens_ml.color import delta_e2000, hex_to_rgb, rgb_to_lab
    R = REAGENTS[rid]
    refs = [rgb_to_lab(hex_to_rgb(R["baseline"]))] + [rgb_to_lab(hex_to_rgb(o["hex"])) for o in R["outcomes"]]
    X = []
    while len(X) < n:
        lab = np.array([rng.uniform(15, 90), rng.uniform(-60, 60), rng.uniform(-60, 60)])
        if min(float(delta_e2000(lab, r)) for r in refs) > 30:
            X.append(well_features(rid, lab_to_rgb(lab), np.array([246.0, 246, 246]), {"spread_L": 2, "spread_ab": 2}))
    pred, _, _ = model.predict(np.array(X))
    return float(np.mean(pred == UNCLEAR))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sessions", type=int, default=110)
    ap.add_argument("--plates", type=int, default=24)
    ap.add_argument("--test-frac", type=float, default=0.3)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--real", default=None, help="folder of real labelled photos (optional)")
    ap.add_argument("--out", default=str(HERE / "models" / "narcolens-wells-v2.json"))
    args = ap.parse_args()

    t0 = time.time()
    rng = np.random.default_rng(args.seed)
    jobs = [(f"syn-{i}", args.plates, int(rng.integers(1 << 30))) for i in range(args.sessions)]
    rows, det_err, det_fail, qual = [], [], 0, []
    with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) - 1)) as ex:
        for r, e, f, q in ex.map(run_session, jobs):
            rows += r; det_err += e; det_fail += f; qual += q
    print(f"rendered {args.sessions * args.plates} plates / {len(rows)} wells in {time.time() - t0:.0f}s")

    n_test = int(args.sessions * args.test_frac)
    n_cal = max(2, int(args.sessions * 0.12))
    test_s = {f"syn-{i}" for i in range(args.sessions - n_test, args.sessions)}
    cal_s = {f"syn-{i}" for i in range(args.sessions - n_test - n_cal, args.sessions - n_test)}
    if args.real:
        real = load_real(args.real)
        rs = sorted({r[0] for r in real})
        test_s |= set(rs[::3]); cal_s |= set(rs[1::6])
        rows += real

    det_err = np.array(det_err)
    report = {"detection": {"median_err_r": float(np.median(det_err)), "p95_err_r": float(np.percentile(det_err, 95)),
                            "off_by_half_radius": float(np.mean(det_err > 0.5)), "plate_not_found": det_fail},
              "quality_flags": {k: sum(k in q for q in qual) / len(qual) for k in ("blurry", "too_dark", "overexposed", "glare")},
              "reagents": {}}
    model = {"version": 2, "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "trained_on": "synthetic-bootstrap" + (" + real" if args.real else ""), "features": FEATURE_NAMES,
             "white_target": 246.0, "unclear_below": UNCLEAR_BELOW, "reagents": {}}
    probe_rng = np.random.default_rng(123)

    for rid in REAGENTS:
        cl = classes(rid)
        sel = [r for r in rows if r[2] == rid]
        X = np.array([r[4] for r in sel]); y = np.array([r[3] for r in sel]); s = np.array([r[0] for r in sel])
        yi = np.array([cl.index(v) for v in y]); CL = np.array(cl)
        te = np.isin(s, list(test_s)); ca = np.isin(s, list(cal_s)); tr = ~te & ~ca
        m = WellModel(cl).fit(X[tr], yi[tr], X[ca], yi[ca])
        pred, p, d = m.predict(X[te])
        raw_p = softmax(m.lr.decision_function(m.sc.transform(X[te])))
        yte = np.searchsorted(m.lr.classes_, yi[te])

        rule = rule_predict(rid, X[te])
        sc = StandardScaler().fit(X[tr])
        rf = RandomForestClassifier(300, min_samples_leaf=2, n_jobs=-1, random_state=0).fit(sc.transform(X[tr]), yi[tr])
        rf_pred = CL[rf.predict(sc.transform(X[te]))]
        res = {"n_train": int(tr.sum()), "n_cal": int(ca.sum()), "n_test": int(te.sum()),
               "rule_dE2000": {"acc": accuracy_score(y[te], rule), **dict(zip(("missed", "false_alarm", "wrong_drug"), safety(y[te], rule)))},
               "random_forest": {"acc": accuracy_score(y[te], rf_pred)},
               "deployed": {"acc": accuracy_score(y[te], pred), "macro_f1": f1_score(y[te], pred, average="macro"),
                            **dict(zip(("missed", "false_alarm", "wrong_drug"), safety(y[te], pred))),
                            "ece_before_T": ece(raw_p, yte), "ece_after_T": ece(p, yte), "T": m.T,
                            "flagged_ood_on_test": float(np.mean(d > m.ood_thr)),
                            "unknown_colours_caught": ood_probe(rid, m, probe_rng),
                            "confusion": {"labels": cl, "matrix": confusion_matrix(y[te], pred, labels=cl).tolist()}}}
        report["reagents"][rid] = res
        e = m.export(); e["test_acc"] = round(res["deployed"]["acc"], 4)
        model["reagents"][rid] = e
        D = res["deployed"]
        print(f"{rid:9s} rule {res['rule_dE2000']['acc']:.3f} | rf {res['random_forest']['acc']:.3f} | DEPLOYED {D['acc']:.3f} "
              f"missed {D['missed']:.3f} false-alarm {D['false_alarm']:.3f} wrong-drug {D['wrong_drug']:.3f} "
              f"| ECE {D['ece_before_T']:.3f}->{D['ece_after_T']:.3f} | unknown-colour caught {D['unknown_colours_caught']:.2f}")

    out = Path(args.out); out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(model, separators=(",", ":")), encoding="utf-8")
    (out.parent / out.name.replace("narcolens-wells", "metrics")).write_text(json.dumps(report, indent=2, default=float), encoding="utf-8")
    print(f"detection: median {report['detection']['median_err_r']:.3f} r, >0.5r {report['detection']['off_by_half_radius']:.2%}; "
          f"quality flags {report['quality_flags']}")
    print(f"model -> {out} ({out.stat().st_size // 1024} KB) in {time.time() - t0:.0f}s total")


if __name__ == "__main__":
    main()
