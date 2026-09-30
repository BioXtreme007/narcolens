"""Python <-> JS parity: same features and same prediction from the exported model.
Run: python tests/parity.py   (needs node on PATH)"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from narcolens_ml.features import well_features
from narcolens_ml.reagents import REAGENTS

ROOT = Path(__file__).resolve().parent.parent
model = json.loads((ROOT / "models" / "narcolens-wells-v1.json").read_text())

def py_predict(rid, x):
    m = model["reagents"][rid]
    z = (np.array(x) - m["mean"]) / np.where(np.array(m["std"]) == 0, 1, m["std"])
    lg = np.array(m["W"]) @ z + np.array(m["b"])
    p = np.exp(lg - lg.max()); p /= p.sum(); k = int(p.argmax())
    return ("unclear" if p[k] < model["unclear_below"] else m["classes"][k]), float(p[k])

rng = np.random.default_rng(0)
cases = []
for rid in REAGENTS:
    for _ in range(40):
        well = rng.uniform(10, 250, 3).round(1); white = rng.uniform(150, 255, 3).round(1)
        x = well_features(rid, well, white)
        lab, p = py_predict(rid, x)
        cases.append({"rid": rid, "well": well.tolist(), "white": white.tolist(), "x": x.tolist(), "label": lab, "p": p})

js = """
const fs=require('fs'), vm=require('vm');
const ctx={console,Math,JSON,Object,Array,Set,Number,String,parseInt,document:{},unescape,encodeURIComponent};
vm.createContext(ctx);
vm.runInContext('var WELL_MODEL='+fs.readFileSync(process.argv[2],'utf8')+';', ctx);
vm.runInContext(fs.readFileSync(process.argv[3],'utf8')+';this.__f={wellFeatures,predictWell};', ctx);
const cases=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
let maxd=0, mism=0;
for(const c of cases){ const F=ctx.__f.wellFeatures(c.rid,c.well,c.white); F.x.forEach((v,i)=>maxd=Math.max(maxd,Math.abs(v-c.x[i])));
  const P=ctx.__f.predictWell(c.rid,F.x); if(P.label!==c.label) mism++; }
console.log(JSON.stringify({n:cases.length,max_feature_diff:maxd,label_mismatches:mism}));
"""
tmp = ROOT / "tests" / "_cases.json"; tmp.write_text(json.dumps(cases))
jsf = ROOT / "tests" / "_parity.js"; jsf.write_text(js)
core = ROOT.parent / "prototype" / "src" / "10-core.js"
out = subprocess.run(["node", str(jsf), str(ROOT / "models" / "narcolens-wells-v1.json"), str(core), str(tmp)], capture_output=True, text=True)
print(out.stdout or out.stderr)
r = json.loads(out.stdout)
assert r["max_feature_diff"] < 1e-6 and r["label_mismatches"] == 0, "PARITY FAILED"
print("PARITY OK")
