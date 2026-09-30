# NarcoLens — well classifier

Reads the three wells of a spot-plate photo and says, per well: **negative**, **a drug** (per reagent), or **unclear**.

```
photo ──► detect wells ──► colour features ──► per-reagent model ──► negative / drug / unclear
          (plate + Hough)   (white plate ring      (softmax, 6 KB,        (confidence < 60%
                             cancels the light)     runs on the phone)     = unclear)
```

## Run it

```powershell
cd narcolens\ml
pip install -r requirements.txt
python train.py                  # renders ~2,160 synthetic plates, trains, writes models\narcolens-wells-v1.json
python tests\parity.py           # proves the app's JS/TS gives identical features + predictions
python train.py --real data\real # once you have real photos (below)
```

`models/narcolens-wells-v1.json` is embedded into the prototype by `prototype/build.py`, and it will be bundled into the Expo app.

## Current results (synthetic data, tested on 27 unseen lighting/camera sessions)

| Reagent | Old ΔE rule | **Deployed model** | Drug missed | False alarm |
|---|---|---|---|---|
| Test B (cannabis) | 90.7% | **97.7%** | 2.5% | 0% |
| Test E part 1 | 91.3% | **98.7%** | 0% | 0% |
| Test E part 2 | 95.7% | **99.2%** | 0% | 0% |
| Marquis | 88.0% | **97.6%** | 0% | 0% |
| Mecke | 84.5% | **99.6%** | 0% | 0% |
| Mandelin | 82.3% | **96.8%** | 0% | 0% |
| Scott | 91.6% | **98.7%** | 0% | 0% |

Well detection: median centre error is 2.5% of the well radius. 0.6% of wells were off by more than half a radius.

**Read these numbers honestly.** They measure the pipeline against our own simulator, not against real chemistry. They show that lighting correction and the model work. They do not show that the reference colours in `data/reagents.json` match the real HAL kit. Only real photos can show that.

## Why it's built this way

- **Three coarse outcomes per well**, not fine colour shades. In smartphone colorimetry research (chemrxiv-2021-0zbwm), fine-grained 10-class accuracy dropped to 34–67% on new conditions, while 3-class accuracy held at 91–97%.
- **An in-frame reference.** The white plate around each well is photographed under the same light, so dividing by it removes most of the street-lamp or LED tint and the phone's white-balance guess.
- **Train/test split by session**, never at random. Random splits overestimate accuracy on a new phone or a new place.
- **Logistic regression beat the random forest and MLP here** once you account for size: it is 6 KB, it needs no native ML runtime in React Native, and it is easy to audit in court.

## Real data: what the team needs to collect

This is the most important next step. With the kit (or safe look-alikes, such as food dye in water for colour-only runs):

1. Make one folder per **session**, meaning one place + one light + one phone. Examples: `data\real\lab_tubelight_redmi\` and `data\real\street_sodium_pixel\`. Aim for 10+ sessions with different phones and lights.
2. Take a top-down photo of the plate with all 3 wells and some white plate around each one. Take 15–30 photos per session.
3. Add a `labels.csv` in each folder, using `data\real\_example_session\labels.csv` as the template:
   ```
   photo,reagent1,label1,reagent2,label2,reagent3,label3
   IMG_0012.jpg,testB,Cannabis,testE1,negative,testE2,negative
   ```
   - Reagent ids are `testB testE1 testE2 marquis mecke mandelin scott`.
   - Labels are `negative`, `unclear`, or the drug name exactly as it appears in `reagents.json`.
4. Also photograph each reagent's **known positive and blank**. Then update the `hex` values in `data/reagents.json` from those photos.
5. Delete `data\real\_example_session` (it's synthetic, only there to show the format), then run `python train.py --real data\real`.

Once the app is live, every officer "Yes / No" verdict and every lab-confirmed result becomes a new labelled example.

## Files

| Path | What it does |
|---|---|
| `narcolens_ml/color.py` | sRGB↔Lab, CIEDE2000, HSV |
| `narcolens_ml/synth.py` | synthetic plate photos (illuminants, auto white balance, glare, blur, JPEG, weak reactions) |
| `narcolens_ml/detect.py` | plate and well detection |
| `narcolens_ml/features.py` | the 16 features. **The app must match these exactly**, and `tests/parity.py` checks that it does. |
| `train.py` | dataset generation, session-split evaluation, model export |
| `models/metrics-v1.json` | full metrics and confusion matrices |
