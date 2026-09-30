"""
Train the NarcoLens per-well classifier.

  python train.py                         # synthetic bootstrap data only
  python train.py --real data/real         # + real labelled photos (see README.md, "Real data")

Pipeline per photo: detect wells -> plate-referenced colour features -> per-reagent model.
Split is BY SESSION (lighting + camera), never random, so the score reflects new conditions.
Exports a softmax (logistic regression) per reagent to models/narcolens-wells-v1.json (runs on-device, no server).
"""
import argparse
import csv
import json
import os
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler

from narcolens_ml.detect import detect_wells
from narcolens_ml.features import FEATURE_NAMES, sample_well, well_features
from narcolens_ml.reagents import NEG, REAGENTS, UNCLEAR, classes
from narcolens_ml.synth import random_session, render_plate
import cv2

HERE = Path(__file__).parent
UNCLEAR_BELOW = 0.60          # model confidence under this -> report "unclear"


def run_session(args):
    sid, n_plates, seed = args
    rng = np.random.default_rng(seed)
    sess = random_session(rng)
    rows, det_err, det_fail = [], [], 0
    for _ in range(n_plates):
        img, wells = render_plate(sess, rng)
        det = detect_wells(img)
        if det is None:
            det_fail += 1
            det = [(w.cx, w.cy, w.r) for w in wells]
        for w, (x, y, r) in zip(wells, det):
            det_err.append(float(np.hypot(w.cx - x, w.cy - y) / w.r))
            well_rgb, white = sample_well(img, x, y, r)
            rows.append((sid, sess.illum_name, w.reagent, w.label, well_features(w.reagent, well_rgb, white)))
    return rows, det_err, det_fail


def load_real(root):
    """data/real/<session>/labels.csv with columns: photo,reagent1,label1,reagent2,label2,reagent3,label3
    Each <session> folder = one place/light/phone. Labels: negative | unclear | <drug name as in reagents.json>."""
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
            s = 900 / max(img.shape[:2]); img = cv2.resize(img, None, fx=s, fy=s) if s < 1 else img
            det = detect_wells(img)
            if det is None:
                print("  no plate found in", rec["photo"]); continue
            for i, (x, y, r) in enumerate(det, 1):
                rid, label = rec[f"reagent{i}"], rec[f"label{i}"]
                if rid not in REAGENTS or label not in classes(rid):
                    print(f"  bad label {rid}/{label} in {rec['photo']}"); continue
                well_rgb, white = sample_well(img, x, y, r)
                rows.append(("real-" + sess_dir.name, "real", rid, label, well_features(rid, well_rgb, white)))
            n += 1
    print(f"loaded {n} real photos / {len(rows)} wells from {root}")
    return rows


def rule_predict(reagent_id, X):
    """The prototype's CIEDE2000 rule, as a baseline to beat."""
    cl = classes(reagent_id)
    out = []
    for f in X:
        dE_base, dE = f[12], f[13:13 + len(cl) - 2]
        k = int(np.argmin(dE))
        if dE[k] <= 10 and dE[k] < dE_base:
            out.append(cl[1 + k])
        elif dE_base <= 12:
            out.append(NEG)
        else:
            out.append(UNCLEAR)
    return np.array(out)


def safety(y_true, y_pred):
    """missed = drug present but called negative; false_alarm = clean but called a drug."""
    drug_t = (y_true != NEG) & (y_true != UNCLEAR)
    drug_p = (y_pred != NEG) & (y_pred != UNCLEAR)
    missed = np.mean(y_pred[drug_t] == NEG) if drug_t.any() else 0.0
    false_alarm = np.mean(drug_p[y_true == NEG]) if (y_true == NEG).any() else 0.0
    return float(missed), float(false_alarm)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sessions", type=int, default=90)
    ap.add_argument("--plates", type=int, default=24)
    ap.add_argument("--test-frac", type=float, default=0.3)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--real", default=None, help="folder of real labelled photos (optional)")
    ap.add_argument("--out", default=str(HERE / "models" / "narcolens-wells-v1.json"))
    args = ap.parse_args()

    t0 = time.time()
    rng = np.random.default_rng(args.seed)
    jobs = [(f"syn-{i}", args.plates, int(rng.integers(1 << 30))) for i in range(args.sessions)]
    rows, det_err, det_fail = [], [], 0
    with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) - 1)) as ex:
        for r, e, f in ex.map(run_session, jobs):
            rows += r; det_err += e; det_fail += f
    print(f"rendered {args.sessions * args.plates} plates / {len(rows)} wells in {time.time() - t0:.0f}s")

    n_test = int(args.sessions * args.test_frac)
    test_sessions = {f"syn-{i}" for i in range(args.sessions - n_test, args.sessions)}
    if args.real:
        real = load_real(args.real)
        real_sessions = sorted({r[0] for r in real})
        test_sessions |= set(real_sessions[::3])          # every 3rd real session is held out for testing
        rows += real
    det_err = np.array(det_err)
    report = {"detection": {"median_err_r": float(np.median(det_err)), "p95_err_r": float(np.percentile(det_err, 95)),
                            "miss_rate_gt_half_r": float(np.mean(det_err > 0.5)), "plate_not_found": det_fail},
              "reagents": {}}
    model = {"version": 1, "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
             "trained_on": "synthetic-bootstrap" + (" + real" if args.real else ""), "features": FEATURE_NAMES, "white_target": 246.0,
             "unclear_below": UNCLEAR_BELOW, "reagents": {}}

    for rid in REAGENTS:
        cl = classes(rid)
        sel = [r for r in rows if r[2] == rid]
        X = np.array([r[4] for r in sel]); y = np.array([r[3] for r in sel]); s = np.array([r[0] for r in sel])
        te = np.isin(s, list(test_sessions)); tr = ~te
        yi = np.array([cl.index(v) for v in y]); CL = np.array(cl)
        sc = StandardScaler().fit(X[tr])
        Xtr, Xte = sc.transform(X[tr]), sc.transform(X[te])
        res = {"n_train": int(tr.sum()), "n_test": int(te.sum())}

        pred = rule_predict(rid, X[te])
        res["rule_dE2000"] = {"acc": accuracy_score(y[te], pred), "macro_f1": f1_score(y[te], pred, average="macro"),
                              "missed_drug": safety(y[te], pred)[0], "false_alarm": safety(y[te], pred)[1]}
        for name, clf in [("logreg", LogisticRegression(max_iter=3000, C=2.0)),
                          ("random_forest", RandomForestClassifier(300, min_samples_leaf=2, n_jobs=-1, random_state=0)),
                          ("mlp", MLPClassifier((32, 16), alpha=1e-3, max_iter=3000, early_stopping=True, random_state=0))]:
            clf.fit(Xtr, yi[tr])
            p = CL[clf.predict(Xte)]
            res[name] = {"acc": accuracy_score(y[te], p), "macro_f1": f1_score(y[te], p, average="macro"),
                         "missed_drug": safety(y[te], p)[0], "false_alarm": safety(y[te], p)[1]}
            if name == "logreg":
                mlp = clf
                prob = clf.predict_proba(Xte)
                gated = np.where(prob.max(1) < UNCLEAR_BELOW, UNCLEAR, CL[clf.classes_[prob.argmax(1)]])
                res["deployed"] = {"acc": accuracy_score(y[te], gated), "macro_f1": f1_score(y[te], gated, average="macro"),
                                    "missed_drug": safety(y[te], gated)[0], "false_alarm": safety(y[te], gated)[1],
                                    "confusion": {"labels": cl, "matrix": confusion_matrix(y[te], gated, labels=cl).tolist()}}
        report["reagents"][rid] = res
        model["reagents"][rid] = {
            "classes": [cl[int(c)] for c in mlp.classes_], "mean": sc.mean_.round(6).tolist(), "std": sc.scale_.round(6).tolist(),
            "W": mlp.coef_.round(5).tolist(), "b": mlp.intercept_.round(5).tolist(), "kind": "softmax", "test_acc": round(res["deployed"]["acc"], 4)}
        print(f"{rid:9s} rule {res['rule_dE2000']['acc']:.3f} | logreg {res['logreg']['acc']:.3f} | rf {res['random_forest']['acc']:.3f} "
              f"| mlp {res['mlp']['acc']:.3f} | DEPLOYED logreg+gate {res['deployed']['acc']:.3f} missed {res['deployed']['missed_drug']:.3f} "
              f"false-alarm {res['deployed']['false_alarm']:.3f}")

    out = Path(args.out); out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(model, separators=(",", ":")), encoding="utf-8")
    (out.parent / "metrics-v1.json").write_text(json.dumps(report, indent=2, default=float), encoding="utf-8")
    print(f"detection: median {report['detection']['median_err_r']:.3f} r, >0.5r {report['detection']['miss_rate_gt_half_r']:.3%}")
    print(f"model -> {out} ({out.stat().st_size // 1024} KB) in {time.time() - t0:.0f}s total")


if __name__ == "__main__":
    main()
