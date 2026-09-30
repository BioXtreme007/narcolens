# Real photograph sources for presumptive colour tests

Compiled 2026-09-30. Everything below was checked by fetching the page or API unless marked UNVERIFIED.
Bottom line: there is NO ready-made, open, labelled photo dataset covering Marquis/Mecke/Mandelin/Simon/Scott/D-L/FBBB/Ehrlich across many drugs. Roboflow, Kaggle, GitHub, OSF and Dataverse searches found nothing relevant. The realistic strategy is (a) one large open dataset (Strathclyde xylazine, figshare), (b) a few openly-licensed Wikimedia photos, (c) numeric reference colours from NIJ 0604.01 as calibration anchors, (d) request-on-email datasets, (e) frame extraction from harm-reduction videos for private internal use only (licence permitting).

## 1. Ranked sources (best first)

### 1. Strathclyde "Presumptive Tests for Xylazine - A Computer Vision Approach" (figshare, CC BY 4.0)
- Paper: https://pmc.ncbi.nlm.nih.gov/articles/PMC11961553/ (CC BY 4.0; Chang, Donnachie, McCabe, Barrington, Reid; Kineticolor software)
- Data: https://doi.org/10.6084/m9.figshare.26564395.v2 , direct file https://ndownloader.figshare.com/files/50994189 (Supporting Information for publication.zip, **3.68 GB**, CC BY 4.0, verified through the figshare API)
- Content: Marquis, Mandelin and Mecke reactions (video + image analysis) of xylazine vs morphine, fentanyl, heroin, methamphetamine and others; "computer vision data" folders ordered by paper figure. Have not unzipped it (size), so the exact number of frames and whether raw video is included is UNVERIFIED. Reported deltaE / RAL colour codes are in the table below.
- Labels: folder/figure names give reagent + substance. Convert to labels.csv by hand per video/frame.
- Verdict: only open, downloadable, CC BY real-photo data on Marquis/Mandelin/Mecke found. Download first.

### 2. Wikimedia Commons (openly licensed, see manifest.csv; 11 files downloaded)
API search of Commons found only a small set of genuine reagent-reaction photos (details in section 3). Attribution/share-alike required for CC BY / CC BY-SA files.

### 3. Notre Dame Paper Analytical Device (PAD) project
- Paper (open): https://ar5iv.arxiv.org/html/1704.04251 (arXiv 1704.04251, "Visual Recognition of Paper Analytical Device Images for Detection of Falsified Pharmaceuticals"). Dataset described: 780 cropped card images, 26 APIs/excipients, 30 images each, 11 reagent zones plus timer. **No download link or licence given**; authors say a larger database is being built. Contact: mlieberm@nd.edu (Marya Lieberman), sbanerj1@nd.edu.
- Web app https://pad.crc.nd.edu has a "View PAD Cards" page but it redirects to an Auth0 login, so it is NOT public.
- Theses on curate.nd.edu (figshare-based): "Development and Implementation of a Paper Analytical Device for Field Drug Detection" https://curate.nd.edu/articles/thesis/Development_and_Implementation_of_a_Paper_Analytical_Device_for_Field_Drug_Detection/24733077 and "Enzyme-Based Paper Tests for Target Detection in Low-Resource Settings" https://curate.nd.edu/articles/thesis/Enzyme-Based_Paper_Tests_for_Target_Detection_in_Low-Resource_Settings/24732486 . Licence and image content not checked. Note: PADs are pharmaceutical QA cards, NOT the Marquis-type reagents, so use only for domain adaptation / colour-constancy pretraining, not for our labels.
- Action: email for the 780-image set and the field data; ask for a research licence.

### 4. Brazil Scott-test dataset (cocaine purity, cobalt thiocyanate)
- Paper (open access, CC BY): https://new.scielo.br/j/qn/a/ZMFsPhWS76zMDKLGvmCLdRC/?lang=en ("Digital image processing and machine learning as an enhancement of the Scott test", Quimica Nova)
- 20 cocaine samples x 5 photos (100x100 crops, 1000 images), medium vs high purity. Raw photos "available from the corresponding author upon reasonable request". Only Scott, only cocaine, but useful for Scott positive class. Email the corresponding author.

### 5. Choodum / Daeid / Elkins literature (numbers, mostly no raw photos)
- Elkins et al. 2017, "Colour quantitation for chemical spot tests for a controlled substances presumptive test database", Drug Test Anal, https://analyticalsciencejournals.onlinelibrary.wiley.com/doi/10.1002/dta.1949 : 12 spot tests (cobalt thiocyanate, Dille-Koppanyi, D-L, Mandelin, Marquis, nitric acid, p-DMAB, FeCl3, Froehde, Mecke, Zwikker, Simon's) quantified in colour space to seed a database. Wiley page returned 403 to our fetch so the exact Lab table and the database availability are UNVERIFIED. Email Kelly Elkins (Towson University) and ask for the database.
- Choodum et al. (Simon test + phone RGB, methamphetamine): https://www.sciencedirect.com/science/article/abs/pii/S0379073813005203 ; Digital image colorimetric amphetamine: https://strathprints.strath.ac.uk/33455/ ; opiates: https://strathprints.strath.ac.uk/41762/ . RGB calibration curves only; no public image sets.
- Adegoke & Nic Daeid 2026, Forensic Chemistry 48:100733, CC BY, PDF https://discovery.dundee.ac.uk/ws/files/163222661/1-s2.0-S2468170926000093-main.pdf : new universal redox reagent, colorimetric fingerprints of controlled substances. Not a classic-reagent set; figures may still show reacted wells (not reviewed in detail).
- Objective presumptive field-testing with smartphone (centrifugal microdevices): https://acs.figshare.com/articles/journal_contribution/Objective_Method_for_Presumptive_Field-Testing_of_Illicit_Drug_Possession_Using_Centrifugal_Microdevices_and_Smartphone_Analysis/3581181 (figshare, ACS; likely just the paper, UNVERIFIED).
- Review "A review of chemical spot tests" (UTS, open): https://opus.lib.uts.edu.au/handle/10453/123158 - text tables of colours per reagent/drug (35 pages; only saved locally, not mined).

### 6. Harm-reduction colour charts (photos/graphics exist but copyrighted; all-rights-reserved unless stated)
- Wikipedia list (pointers): https://en.wikipedia.org/wiki/List_of_reagent_testing_color_charts
- NUAA Drug Checking (Australia) PDF charts for Ehrlich, Froehde, Hofmann, Liebermann, Mandelin, Marquis, Mecke, Morris, Robadope, Simons: https://testkits.nuaa.org.au/pages/charts . No licence stated -> treat as all rights reserved; use only as human reference, email for permission.
- Reagent Tests UK https://www.reagent-tests.uk/reagent-test-colours/ ("(c) Reagent Tests UK 2026", image chart only; no reuse licence).
- Protest Kit https://protestkit.eu/results/ (results app), DanceSafe, Bunk Police (YouTube): no open licence found; do NOT scrape. Ask for written permission.
- PsychonautWiki https://psychonautwiki.org/wiki/Reagent_testing_kits : text says "Content is available under CC BY-SA 4.0 unless otherwise noted", but the page has a TEXT colour table only, no reaction photos (verified). The text table (Mandelin/Marquis/Mecke/Simon's/Froehde/Liebermann vs substances) is usable as reference labels under CC BY-SA.
- DrugsData.org (EcstasyData): lab GC/MS-confirmed samples; site says reagent testing is supplemented, but no downloadable reagent-photo set and no reuse licence found (FAQ fetched). Scraping not advised; email for research access.
- Reddit r/ReagentTesting wiki (community photos, mixed copyright): not usable without per-image permission.

### 7. Datasets that exist but are NOT what we need
- Mendeley "Illicit Pills" (117 images, 5 ATS pill classes) https://data.mendeley.com/datasets/bmsz34n3dk/2 - pill shape only, no reagents (useful as background/pill-region negatives).
- Zenodo record 10412066 (captopril smartphone RGB assay), Zenodo 7479700 (saliva drug testing) - unrelated chemistry.
- Roboflow Universe (search "drug", "reagent", "medication"): only pill/prescription detection. Kaggle/GitHub/OSF/Dataverse searches: no reagent colour-test dataset found.

## 2. Indian HAL NDPS kit (Test A-G)
Nothing usable found publicly.
- HAL is the sole public-sector supplier to NCB (Wikipedia https://en.wikipedia.org/wiki/Hindustan_Antibiotics ). News mentions of kits: https://www.freepressjournal.in/amp/indore/indore-police-equip-all-stations-with-drug-detection-kits , https://www.deccanchronicle.com/sircilla-police-nab-8-with-help-of-ganja-kits
- Slide deck https://www.slideshare.net/slideshow/identification-of-narcotic-drug-psychotropic-substances-use-of-latest-equipments-and-field-test-kit-in-drug-detectionpptx/255512887 mentions the HAL kit (slide 9) and shows apparatus photos (slide 15) but contains NO test protocols or colour photos.
- ITEC/Trinidad course PDF (https://mpa.gov.tt/sites/default/files/file_upload/psacourses/ITEC/Chemical Analysis of Narcotics Drugs %26 Psychotropic Substance and Precursor Chemicals.pdf) appeared in searches but our fetch failed with an SSL error; it is an Indian ITEC course and MAY describe the field kit. Try downloading it with curl -k or a browser.
- Studocu https://www.studocu.com/in/document/national-forensic-sciences-university/bachelors-in-forensic-science/identification-of-ndps-latest-equipment-field-test-kits/149665990 (login-walled, not read).
- Your own tested facts (Test B cannabis orange-red lower layer; Test E cocaine/methaqualone) could not be independently confirmed from the web; treat as needing confirmation from an actual HAL kit leaflet. Practical route: buy one kit (or ask an NCB/State Excise unit) and photograph the colour card in the lid. No YouTube training video with a stable URL was found in search results; searching YouTube directly for "NDPS drug detection kit demonstration" and extracting frames is possible but each video is copyrighted (private research only, do not redistribute).
- Related open Indian source: Jaiswal et al. 2020, IJFCM 7(4):160-165, "Screening/spot test of narcotics" https://ijfcm.org/archive/volume/7/issue/4/article/14551/pdf (open access). Text-only colours for Marquis/Mandelin/Liebermann/Froehde vs opioids (e.g., morphine Marquis purple-red -> violet -> blue; heroin Marquis violet; Mandelin blue-grey; pethidine Marquis orange). No photos.

## 3. Wikimedia Commons file inventory (API-verified 2026-09-30)
Downloaded to `ml/data/real_web/` (11 files, manifest.csv). Attribution needed for CC BY/CC BY-SA.

| File | Licence | Author | Content | Use |
|---|---|---|---|---|
| Marquis Reagent.jpg | CC BY 2.0 | Jack Spades | Marquis on opium, 5616x3744 | Marquis-opiate positive (purple-brown) |
| Duquenois Reagent.jpg | CC BY 2.0 | Jack Spades | D-L on Afghan hashish | D-L cannabis positive |
| Duquenois levine step1/2/3.jpg | Public domain | US DEA | 3 stages incl. purple chloroform layer | D-L cannabis positive (step3) and intermediate steps |
| LSD Ehrlich reagent test-strip.jpg | CC BY-SA 4.0 | WikiLinuz | Ehrlich on LSD blotter | Ehrlich positive |
| LSD Ehrlich reagent test.jpg | CC0 | WikiLinuz | Ehrlich on LSD blotter | Ehrlich positive |
| Drug test.jpg | Public domain (CBP) | CBP | ODV ampoule kit + pills | weak, messy |
| Field drug test.jpg | Public domain (Ecuador govt) | Min. de Gobierno | field kit | unread; check |
| Reagent drug checking kit.png | CC BY-SA 4.0 | Cdreue | 12 reagents + dimple tile with 12 spots (Mar, Me, Ma, Ei, Fr, Roba, Sim, Ehrl, Zim, Scot, Hof) | multi-reagent, sample unknown |
| Quick drug testers.JPG | Public domain (MKFI) | MKFI | museum display | background only |

Other Commons files seen but NOT downloaded: Fentanyl-test-strip.jpg (CC BY-SA 4.0, immunoassay strip, not a colour test), Afghan Hashish Thin Layer Chromatography (PD, TLC not colour test), Marquis-Reaktion.svg (diagram). Commons has NO files for Mecke, Mandelin, Simon's, Scott (drug), Fast Blue BB, Zimmermann, Liebermann, Froehde, or HAL kit (searched by name; results were unrelated). Category:Cannabis tests -> Category:Duquenois-Levine reagent (only those images). Only 7 true reaction photos exist, so the 25-image target could not be met.

## 4. UNODC "Rapid Testing Methods of Drugs of Abuse" (ST/NAR/13/Rev.1)
- Landing page (original URL 404 for us): search-indexed https://www.unodc.org/unodc/en/scientists/rapid-testing-methods-of-drugs-of-abuse_new.html ; UN Digital Library record https://digitallibrary.un.org/record/78906 (403 to fetch; download in a browser). Also https://digitallibrary.un.org/record/674092/files/Guidanceequipment.pdf (guidance on equipment, found in search) and the UNODC "Drug and precursor field test kits" pdf (syntheticdrugs.unodc.org, 404).
- It is a text manual (colour descriptions only, no photos). Colour descriptions could not be extracted programmatically; use it as label authority, not images.

## 5. Numeric reference colours (NIJ Standard 0604.01, public domain)
Source: NIJ "Color Test Reagents/Kits for Preliminary Identification of Drugs of Abuse", https://www.ojp.gov/pdffiles1/nij/183258.pdf (US government work, public domain; table 1 gives ISCC-NBS names + Munsell for the final colour at 500 ug drug in a porcelain well/CHCl3). I converted Munsell to sRGB using colour-science (Illuminant C -> Bradford -> sRGB). Hex values are APPROXIMATE (Munsell renotation, not measured under phone camera; dark colours clip). Use as colour-name anchors, not as pixel truth. The NIJ appendix reagent labels: A.1 cobalt thiocyanate, A.2 Dille-Koppanyi, A.3 D-L, A.4 Mandelin, A.5 Marquis, A.6 nitric acid, A.7 p-DMAB (Ehrlich-type), A.8 FeCl3, A.9 Froehde, A.10 Mecke, A.11 Zwikker, A.12 Simon's. Asterisked rows in the paper mark the usual kit reagent.

| Reagent | Drug | Colour name | Munsell | Approx hex | Source |
|---|---|---|---|---|---|
| Cobalt thiocyanate (Scott) | Cocaine HCl (CHCl3 phase) | Strong greenish blue | 5B 5/10 | #0089B1 | NIJ 0604.01 T1 |
| Cobalt thiocyanate | Heroin HCl | Strong greenish blue | 7.5B 6/10 | #00A1D1 | NIJ |
| Cobalt thiocyanate | Methadone HCl | Brilliant greenish blue | 5B 6/10 | #00A4CB | NIJ |
| Cobalt thiocyanate | PCP | Strong greenish blue | 5B 5/10 | #0089B1 | NIJ |
| Duquenois-Levine | THC (EtOH phase) | Deep purple | 7.5P 4/12 | #8D4192 | NIJ |
| Mandelin | Methaqualone | Very orange yellow | 10YR 8/14 | #FFB900 | NIJ |
| Mandelin | Cocaine HCl | Deep orange yellow | 10YR 7/14 | #EA9F00 | NIJ |
| Mandelin | d-Methamphetamine | Dark yellowish green | 10GY 4/6 | #386C39 | NIJ |
| Mandelin | d-Amphetamine | Moderate bluish green | 5BG 5/6 | #238781 | NIJ |
| Mandelin | MDA | Bluish black | 10B 2/2 | #25323D | NIJ |
| Mandelin | Heroin HCl | Moderate reddish brown | 10R 3/6 | #733529 | NIJ |
| Mandelin | Opium | Dark brown | 7.5YR 2/4 | #472A12 | NIJ |
| Mandelin | Oxycodone | Dark greenish yellow | 10Y 6/6 | #9A9743 | NIJ |
| Marquis | d-Methamphetamine | Deep reddish orange | 10R 4/12 | #AD3712 | NIJ |
| Marquis | d-Amphetamine | Strong reddish orange | 10R 6/12 | #E96F42 | NIJ |
| Marquis | Heroin HCl | Deep purplish red | 7.5RP 3/10 | #861A4D | NIJ |
| Marquis | Morphine | Very deep reddish purple | 10P 3/6 | #65375E | NIJ |
| Marquis | Codeine | Very dark purple | 7.5P 2/4 | #402842 | NIJ |
| Marquis | MDA | Black | Black | ~#000000 | NIJ |
| Marquis | Mescaline | Strong orange | 5YR 6/12 | #DB7B17 | NIJ |
| Marquis | LSD | Olive black | 10Y 2/2 | #333221 | NIJ |
| Marquis | Oxycodone | Pale violet | 2.5P 6/4 | #988FAA | NIJ |
| Nitric acid | Mescaline | Dark red | 5R 3/6 | #743335 | NIJ |
| Nitric acid | LSD | Strong brown | 5YR 5/10 | #B6651A | NIJ |
| p-DMAB (Ehrlich-type) | LSD | Deep purple | 7.5P 3/10 | #6E2B73 | NIJ |
| Froehde | LSD | Moderate yellow green | 5GY 6/6 | #889C4F | NIJ |
| Froehde | Morphine | Deep purplish red | 5RP 3/10 | #821D57 | NIJ |
| Froehde | Codeine | Very dark green | 7.5G 2/6 | #003A2A | NIJ |
| Mecke | Heroin HCl | Deep bluish green | 2.5BG 3/8 | #00564B | NIJ |
| Mecke | Morphine | Very dark bluish green | 2.5BG 2/4 | #033833 | NIJ |
| Mecke | LSD | Greenish black | 7.5G 2/2 | #25342E | NIJ |
| Mecke | Hydrocodone | Dark bluish green | 5BG 3/6 | #005351 | NIJ |
| Simon's | d-Methamphetamine | Dark blue | 2.5PB 2/6 | #003357 | NIJ |
| Simon's | MDMA | Dark blue | 2.5PB 2/6 | #003357 | NIJ |
| Simon's | Methylphenidate | Pale violet | 2.5P 6/4 | #988FAA | NIJ |
| Dille-Koppanyi | Phenobarbital (and other barbiturates) | Light purple | 5P 7/8 | #C2A1D8 | NIJ |

Notes: NIJ's Mandelin cocaine/methaqualone rows use the NIJ (Chloroform-extract) protocol and differ from typical harm-reduction (Mandelin on MDMA = dark blue-black; ketamine = orange-brown). Fast Blue BB is not covered by NIJ. Indian HAL test colours are not published.

Xylazine paper (Kineticolor, PMC11961553) values for xylazine only:
| Reagent | Start -> End colour | RAL start -> end | deltaE |
|---|---|---|---|
| Marquis | colourless -> vermillion red | 9003 -> 2002 | 93 |
| Mandelin | yellow orange -> wine red | 2000 -> 3005 | 89 |
| Mecke | colourless -> grey blue | 9003 -> 5008 | 14 |

Text-only expected colours (PsychonautWiki CC BY-SA, IJFCM open access, Jaiswal 2020) are handy for label sanity checks: Marquis MDMA/MDA purple->black, methamphetamine orange->brown, opiates purple, 2C-B/DOM yellow-green; Ehrlich indoles purple; Mandelin MDMA blue-black; Simon's meth blue (secondary amines).

## 6. How to label anything we get, in our format
Our per-photo `labels.csv` header: `photo,reagent1,label1,reagent2,label2,...`
- `photo` = filename relative to the data folder (e.g. `real_web/marquis_opium_JackSpades.jpg`).
- `reagentN` = canonical reagent id (marquis, mecke, mandelin, simon, scott, duquenois, fastblue, ehrlich, hal_A..hal_G).
- `labelN` = the colour class the classifier should output for that reagent (or `neg` for no reaction/unchanged) and optionally drug in a separate `truth_drug` column outside the reagent pairs. Examples:
  - `real_web/marquis_opium_JackSpades.jpg,marquis,purple_brown` (truth drug: opium)
  - `real_web/dl_step3_DEA.jpg,duquenois,purple_lower_layer`
  - `real_web/ehrlich_lsd_blotter_WikiLinuz.jpg,ehrlich,purple`
- Multi-reagent panel photos (dimple tile): crop each well and emit one row per crop. Where the drug is unknown do not assign a drug truth.
- Xylazine set: one row per extracted frame; reagent = folder (marquis/mandelin/mecke); label from the paper's RAL colour or Kineticolor final frame (e.g. marquis xylazine -> vermillion/red; mecke -> grey_blue). Keep video id in a `source_id` column so train/test are split by video, not frame.
- Record licence per row in a sidecar (manifest.csv already has it).

## 7. Recommended next actions
1. Download the 3.7 GB figshare zip and inspect. `curl -L -A "NarcoLens/1.0" -o xylazine_si.zip https://ndownloader.figshare.com/files/50994189`
2. Email (research-use request): Marya Lieberman (Notre Dame PAD, mlieberm@nd.edu); Kelly Elkins (Towson) for the colour database; Scott-test Brazil authors; Reagent Tests UK / Protest / DanceSafe / NUAA for permission to use chart photos.
3. Get a physical HAL kit leaflet or NCB training PDF (try the ITEC PDF with curl -k).
4. Any real data you collect yourself (with a kit, spot plate and white balance card) will beat all of the above for a phone classifier; the open web offers only ~10 clean photos.
