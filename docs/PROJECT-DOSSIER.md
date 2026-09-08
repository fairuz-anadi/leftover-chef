# Leftover Chef — Project Dossier

Everything the project is, everything it will be, and the material to write the
report and win the room.

**AUST CSE Carnival 8.0 — Software & AI Project Exhibition**
Exhibition day: 9 September 2026 · Team: Easteak Ahmed (lead) · Saleh Mahmud Sami (front-end) · Fairuz Anadi (back-end)

> This is the strategy and pitch document. [`context.md`](../context.md) is the
> engineering record — architecture, decisions, known bugs. [`README.md`](../README.md)
> is how you run it. Read this one before the exhibition; read that one before
> you change code.

---

## Table of contents

1. [The pitch in three lengths](#1-the-pitch-in-three-lengths)
2. [Scoring map — the seven criteria](#2-scoring-map--the-seven-criteria)
3. [What the project has today](#3-what-the-project-has-today)
4. [How it is built](#4-how-it-is-built)
5. [What the project will have](#5-what-the-project-will-have)
6. [The fine-tuning track, in full](#6-the-fine-tuning-track-in-full)
7. [The 500-word report](#7-the-500-word-report)
8. [SDG 12 and the CEP mapping](#8-sdg-12-and-the-cep-mapping)
9. [Demo script and judge Q&A](#9-demo-script-and-judge-qa)
10. [Additional suggestions](#10-additional-suggestions)
11. [Risk register](#11-risk-register)
12. [Numbers cheat sheet](#12-numbers-cheat-sheet)

---

## 1. The pitch in three lengths

**One sentence.**
Photograph the inside of your fridge and Leftover Chef tells you what you can
cook right now, starting with whatever is about to go off.

**Thirty seconds.**
About a third of the food grown for people is never eaten, and most of that loss
happens quietly in domestic fridges, to things that were fine four days ago. The
reason is rarely indifference — it is that at 7pm nobody wants to audit a
vegetable drawer and then go hunting for a recipe that matches it. Leftover Chef
removes both steps: one photo replaces the audit, and the ranking replaces the
search. An open-vocabulary vision model names what it sees, you confirm the
list, and every recipe is scored on two things at once — how much of it you can
already make, and how much of your about-to-expire food it would use up.

**Two minutes, for a judge who asks "why is this hard?".**
Three reasons. First, no off-the-shelf detector knows what is in a fridge —
COCO-pretrained YOLOv8 gives you five usable food classes out of eighty, and
fine-tuning means finding a dataset and burning GPU hours on classes you then
cannot change. We use YOLO-World, which takes *text prompts* instead of a fixed
class list, so the vocabulary is a JSON file and adding an ingredient is one
line. Second, a 70%-accurate model cannot be trusted to silently edit somebody's
kitchen, so every detection becomes a chip the cook confirms — which turns an
imperfect model into a reliable product and is, separately, just the correct
interaction. Third, the venue has no internet, so every one of those decisions
had to survive with the network cable pulled out: the detector is a process on
this laptop, the weights are in the repo, and there is a script that rehearses
the whole demo offline.

---

## 2. Scoring map — the seven criteria

The rulebook (§09) says judges score on: **idea, features, design, implementation,
social impact, deployment, clean code.** Here is where we stand on each and what
to say.

| Criterion | Our position | The line to use |
| --- | --- | --- |
| **Idea** | A daily problem every judge has personally had, tied to a real SDG, with a mechanism nobody expects (open-vocabulary detection) | *"Every one of you has stood in front of a fridge at 7pm. We photographed that moment."* |
| **Features** | 55 API endpoints, 14 screens, and the scan is one feature on top of a complete cooking platform — planner, shopping list, cook mode, nutrition, cuisine map | Don't list features. Show the scan, then say *"and that sits on a full platform — here's the shopping list it generates from your week."* |
| **Design** | Coherent token-driven design system, the detection boxes drawn over the user's own photo, confidence on every chip, explanations next to every score | The boxes **are** the design argument. Let them land before you talk. |
| **Implementation** | Three-process local architecture, 86 automated tests, a real bug fixed in the inherited code, honest degradation when the detector is down | *"The alias table was silently dropping ingredients. We found it, fixed it, and wrote the test that stops it coming back."* |
| **Social impact** | SDG 12.3 explicitly — halve per-capita food waste. The expiry ranking is the intervention, not a slogan bolted on | *"The ranking exists to stop food being thrown away. Take it out and the project has no reason to exist."* |
| **Deployment** | Docker Compose for the web tier, one-command local start, SQLite→PostgreSQL path, offline rehearsal script | *"One command brings up three processes and waits for each to answer — because a demo you have to fix on stage is a demo you have lost."* |
| **Clean code** | Every non-obvious decision carries a comment saying *why*, services are small and single-purpose, no mapping tables where a data row will do | Open `UseItUpService.php` on the laptop. The scoring maths is nine lines and reads like prose. |

**The single most important tactical point:** judges see dozens of projects. Most
will be a CRUD app with a login screen. Your differentiator is not the feature
count — it is that **you can pull the WiFi out and it still works.** Say that
out loud, and then do it.

---

## 3. What the project has today

Everything in this section is built, tested and running. Nothing here is
aspirational.

### 3.1 Fridge Scan — the headline

- **Three input paths**: upload a photo, use the webcam, or click a saved fridge
  photo. Saved photos are the demo path; the webcam is the flourish if the hall
  is bright.
- **Open-vocabulary detection**, 49 fridge-specific classes, zero-shot — no
  training run, no labelled dataset. Adding an ingredient is one line of JSON.
- **Detections drawn as labelled boxes over the user's own photo**, each with a
  confidence percentage. Labels flip inside the box when it sits against the top
  edge, so nothing is ever clipped.
- **Boxes are interactive** — click one to drop that ingredient; hover a chip to
  highlight its boxes and dim the rest.
- **Repeat sightings collapse to one chip** but keep every box, so three
  tomatoes read as `Tomato ×3` with three rectangles.
- **Confirm before anything is written.** Nothing reaches the fridge until the
  cook presses the button. A scan is a proposal, not an edit.
- **Chips are marked `have`** when the ingredient is already on the shelf.
- **Unresolvable detections are surfaced, not silently dropped** — "seen but not
  in the ingredient list" is an honest answer to "what happens when it's wrong".
- **Provenance is stored**: which items came from a camera, what the raw
  detector label was, and at what confidence. Camera-added items show a 📷.
- **Runs offline, on CPU, in ~190–475 ms per photo.** No GPU, no API key, no
  network.
- **Degrades honestly**: if the sidecar is down the panel says so, names the
  script that starts it, and the rest of the app carries on.

### 3.2 Use It Up — the differentiator

- **Use-by dates on every fridge item**, editable inline by tapping the date
  chip. Colour-coded: overdue, today, soon, fresh.
- **An "expiring soon" shelf** at the top of the results — *"4 items to use up
  tomorrow"* — with the items named and their deadlines.
- **Recipes ranked on waste avoided as well as cookability**:
  `priority = 0.7 × match% + 0.3 × use_it_up_score`.
- **Urgency is a straight line** from 1.0 (today or overdue) to 0.0 at a 7-day
  horizon. Already-expired food still scores 1.0 rather than disappearing —
  whether yesterday's spinach is a salad or a bin job is the cook's call.
- **Diminishing returns**: the most urgent rescue counts in full, each further
  one adds half of the last, so a kitchen-sink recipe cannot win on volume.
- **Only food you actually hold, and that still has urgency to lose, counts.** A
  recipe does not save your spinach by listing spinach you would have to buy,
  and an onion three weeks out is not being rescued from anything.
- **Use-by dates are estimated for you.** Confirming a scan dates every
  perishable from its typical shelf life — spinach 3 days, chicken 2, garlic 60
  — so the ranking works without anyone typing a date. This is the step that
  makes the whole expiry half usable rather than theoretical.
- **The estimate only ever fills a blank.** An explicit date wins, and anything
  already on the shelf keeps the date the cook gave it even if a later scan sees
  it again.
- **Nothing gets a date that does not need one.** 50 of 92 ingredients have a
  shelf life; salt, rice, oil and every spice have none. A countdown on the salt
  is noise, and noise dilutes the shelf that means "cook this tonight".
- **A guess is labelled a guess** — `~in 5 days` with a dashed border, against
  `in 5 days` for a date the cook set, and the toast says how many were
  estimated. Edit one and it stops being an estimate.
- **Every score shows its reason** — *"Uses up Spinach (tomorrow) · use-it-up
  86"* — so a judge can check the arithmetic on the spot.
- **It vanishes cleanly.** With no dates set anywhere, the second term is zero
  for every recipe and the ranking collapses to plain match percentage.

### 3.3 The cooking platform underneath

Inherited from the FridgeToFork codebase and fully working:

| Area | What it does |
| --- | --- |
| **Recipe library** | 32 recipes across 23 countries and 9 world regions, 290 ingredient links, search and filter by category, diet, cuisine, difficulty, time |
| **Ingredient search** | Rank any free-text ingredient list by match, signed in or out |
| **Guided cook mode** | Instruction steps with **countdown timers parsed out of the text** — "simmer for 20 minutes" becomes a tappable timer — plus serving-size rescaling |
| **Meal planner** | A week grid, breakfast/lunch/dinner slots, servings per entry |
| **Auto shopping list** | Everything a planned week needs that the fridge does not already have, **grouped by supermarket aisle**, with manual add/tick/clear |
| **Nutrition insights** | Calories and macros per serving from a built-in per-100g table over parsed ingredient quantities; optional Spoonacular/Edamam providers that fall back to local on failure |
| **Cuisine map** | Browse recipes by country and region on an interactive world map |
| **Profiles** | Dietary preferences, allergies, skill level, household size — all of which filter search results |
| **Social** | Reviews with star ratings, favourites, user-to-user cooking tips, a points leaderboard |
| **Recipe authoring** | Create and edit recipes with image upload; ingredients are parsed into structured rows automatically |
| **Admin dashboard** | Moderate recipes, users, reviews and contact submissions |
| **Auth** | Email/username + password, Google Identity Services, Sanctum bearer tokens, admin middleware |

### 3.4 The demo and operations rig

- `setup.ps1` — one-time: PHP, npm and Python dependencies, database, model weights.
- `start-demo.ps1` — starts all three processes, **polls each until it answers**,
  reports which detector backend loaded, opens the browser.
- `stop-demo.ps1` — frees the three ports by port, not by process name, so it
  never kills an unrelated `node` or `php`.
- `warm-cache.ps1` — pulls every model file while you still have WiFi.
- `offline-check.ps1` — **the rehearsal.** Turn the network off and it walks the
  whole judge-visible path: detector loaded from local weights, API answering,
  recipe library seeded, a real photo scanned end to end, the alias table
  resolving `capsicum`/`jeera`/`tin of tomatoes`, recipes ranked. Anything that
  quietly wanted a network shows up as a FAIL.
- **Seeded demo account** that opens on a populated state — 25 fridge items,
  four expiring within three days, a half-filled week, favourites and reviews.
  Expiry dates are **relative** (`addDays(2)`), so re-seeding on the morning of
  the exhibition always produces a live "expiring tomorrow" shelf.

### 3.5 Engineering quality

- **86 automated tests, 225 assertions**, all passing.
  - `FridgeScanTest` — alias resolution, chip collapsing, unknown labels, the
    no-write-on-scan rule, sidecar-down handling, non-image rejection.
  - `UseItUpRankingTest` — urgency curve, the expiring shelf order, diminishing
    returns, and that the published score matches the on-screen running order.
  - `ApiErrorShapeTest` — every `/api` route answers in JSON status codes with
    and without an `Accept` header.
  - `ExpiryEstimationTest` — the shelf-life catalog, and every rule about when
    a date may and may not be guessed.
  - `RecipePlatformTest` — end-to-end coverage of the eight original functional
    requirements.
- **Two real bugs found and fixed in the inherited code**, both with regression
  tests — see §9 Q&A, they are good answers to "what went wrong?".
- Comments explain **why**, not what. Every non-obvious decision carries its
  reasoning inline.

---

## 4. How it is built

```
   React 19 + Tailwind 4          Laravel 10 API             FastAPI + YOLO-World
   localhost:5173      ───────>   localhost:8000   ───────>  localhost:8001
   photo, boxes, chips            matching, ranking          detection only
                                        │
                                        └── SQLite  (PostgreSQL in Docker)
```

**Why three processes.** The browser never talks to the detector. Laravel
proxies, which gives one origin, one auth story, and lets the sidecar stay a
stateless "image in, boxes out" service with no database and no idea what an
ingredient is. Swapping the model means restarting one process.

**Why the detector is local.** The rulebook says the venue provides no internet.
That single line rules out every cloud vision API and drives the whole
architecture: weights cached in the repo, fonts bundled instead of CDN-loaded,
nutrition falling back to a local table, SQLite so there is no database server
to bring up.

**How a detector label becomes an ingredient row.** Through the alias table and
nothing else. `vocabulary.json` maps `"tin of tomatoes" → "Chopped Tomatoes"`;
`IngredientSeeder` lists `'tin of tomatoes'` among that row's aliases;
`Ingredient::lookup()` resolves it. There is no mapping code in PHP and there
should never be — adding a detector class means adding an alias.

**Stack.** Laravel 10 / PHP 8.3 · React 19 / Vite 7 / Tailwind 4 · FastAPI +
Ultralytics YOLO-World + PyTorch (CPU) · SQLite / PostgreSQL · Sanctum ·
PHPUnit · Docker Compose · PowerShell tooling.

---

## 5. What the project will have

Ordered by value-per-hour. Nothing below is required for a working exhibition —
§3 is already the demo. This is the answer to *"where does it go next?"*, which
is a question judges ask.

### Tier 0 — before exhibition day (hours, not days)

| # | Item | Why | Effort |
| --- | --- | --- | --- |
| 1 | **3–4 real fridge photos** in `client/src/assets/demo-photos/` | The bundled sample is a food-styling shot; it detects six things but they don't combine into a recipe, so a signed-out visitor sees "0 recipes you can make". **This is the single highest-value hour left.** | 1 h |
| 2 | **Run `offline-check.ps1` with WiFi off, on the venue laptop** | "Should work offline" and "we watched it work offline" are different claims | 30 min |
| 3 | **Submit the 500-word report** (§7) | Rulebook §10 — failing to submit before your slot is a disqualification ground | 1 h |
| 4 | **Rehearse the 3-minute run twice** (§9) | Time is strictly maintained; the project must be running before judges arrive | 1 h |

### Tier 1 — strong additions, low risk

- **Waste-avoided counter.** *"You have rescued 14 items this month."* Log every
  pantry item that gets consumed by a cooked recipe versus deleted while
  expired. Turns SDG 12 from a claim into a number on screen — and it is a
  genuinely small feature: one table, one counter, one card.
- ~~**Expiry estimation on scan.**~~ **Shipped** — see §3.2. Confirming a scan
  now dates the perishables from `ShelfLifeCatalog`, marks the guesses, and
  leaves cupboard staples alone. This was the highest-leverage item on the list
  and the manual step it removed is gone.
- **"Cook this and it's gone" button.** Finish a recipe in cook mode → the
  ingredients it consumed are decremented or removed from the fridge. Closes the
  loop between the two halves of the app.
- **Portion-aware shopping list.** Already grouped by aisle; add quantities
  summed across the planned week.
- **Mobile-first pass on the scan screen.** The natural device for photographing
  a fridge is a phone. The layout is responsive but has not been designed for
  360px.

### Tier 2 — the technical showcase

- **Fine-tuned detector** — see §6, the full track.
- **ONNX Runtime Web**: detection entirely in the browser, no Python process at
  all. Better story ("it runs in a tab, offline, on any laptop") but real
  integration risk. Explicitly deferred, not forgotten.
- **Multi-photo scan sessions.** Photograph three shelves, merge the detections
  into one confirm list.
- **Barcode fallback** for packaged goods the detector reads as "a box". Offline
  barcode → product name needs a local lookup table, which is a bounded problem.
- **Freshness classification.** Not just *is this a tomato* but *is this tomato
  still good*. A second small model, and a genuinely novel contribution — this
  is the one that could become a paper.

### Tier 3 — product direction

- **Household sharing.** One fridge, several phones. Everyone sees what needs
  using.
- **Community waste leaderboard.** The points system already exists; score it on
  food rescued rather than recipes posted.
- **Local language support (Bangla).** Ingredient names and UI. Meaningfully
  widens the audience at AUST and beyond, and the alias table already makes the
  ingredient half nearly free.
- **Supermarket integration** for real expiry dates from receipts.

---

## 6. The fine-tuning track, in full

**Read this first: we deliberately did not fine-tune, and that is a strength, not
a gap.** Be ready to defend it — the argument is in §9. This section is the plan
for doing it anyway, because a fine-tuned model beats open-vocabulary on the
narrow set of classes it was trained for, and because "here is our training
pipeline" is a strong answer to *"what's next?"*.

### 6.1 Why fine-tune at all

Open-vocabulary detection is a generalist. On a cluttered fridge shelf it will
confuse a yoghurt tub for a butter block, and its confidences sit lower than a
specialist's would — our own sample photo returns detections in the 0.15–0.73
band where a fine-tuned model on the same classes would sit at 0.6–0.95. Higher
confidence means fewer chips to drop, which means a faster demo and a better
product.

The honest trade: a fine-tuned model knows exactly the classes it was trained
on, and adding a class means another training run. Open-vocabulary trades peak
accuracy for zero marginal cost per class.

**The end state is both**: run the fine-tuned model first, and fall back to
open-vocabulary for anything outside its class list. The `Detector` class in
`vision/detector.py` is already written as an ordered backend list precisely so
this drops in.

### 6.2 The pipeline

**Step 1 — Dataset (2–3 hours).**
Roboflow Universe has several ready-made fridge/grocery datasets with 20–60
classes. Search "fridge ingredients", "grocery items", "refrigerator objects".
Take one with ≥1,500 images and a permissive licence, export in YOLOv8 format.
Supplement with 200–400 of your own photos — real Bangladeshi fridges, phone
camera, kitchen lighting — because that is the actual deployment distribution
and no public dataset contains it.

**Step 2 — Label your own images (3–4 hours).**
Roboflow's annotator, or CVAT locally. Only label the classes you care about;
map everything else to background. **Match the class names to entries already in
`vision/vocabulary.json`** so no new mapping code is needed anywhere — the alias
table does the rest.

**Step 3 — Train (30–60 min on a GPU, free Colab is enough).**

```python
from ultralytics import YOLO

model = YOLO("yolov8n.pt")          # or yolov8s for a bit more headroom
model.train(
    data="fridge.yaml",
    epochs=60,
    imgsz=640,
    batch=16,
    patience=15,                     # stop early if val mAP plateaus
    augment=True,                    # fridges are dim, cluttered and angled
    hsv_v=0.5,                       # vary brightness hard — hall lighting
    degrees=10, translate=0.1, scale=0.4, fliplr=0.5,
    project="runs", name="fridge-v1",
)
model.val()                          # record mAP50 and mAP50-95 for the report
```

**Step 4 — Evaluate honestly (1 hour).**
Hold out 50 photos the model never saw, ideally from a different kitchen. Record
mAP50, per-class precision/recall, and — the number that actually matters —
**how many ingredients a human has to correct per photo.** That last figure is
the product metric; mAP is the paper metric. Put both in the report.

**Step 5 — Ship it (30 min).**
Drop `best.pt` into `vision/weights/`, and add the backend ahead of the others:

```python
BACKENDS = [
    ("finetuned", os.environ.get("LC_FT_WEIGHTS", "fridge-v1.pt")),
    ("world",     os.environ.get("LC_WORLD_WEIGHTS", "yolov8s-worldv2.pt")),
    ("coco",      os.environ.get("LC_COCO_WEIGHTS", "yolov8n.pt")),
]
```

`_load_one()` needs one branch for the plain-`YOLO` case, which already exists
for `coco`. Nothing else in the stack changes: the sidecar's response shape,
`DetectionMapper`, the alias table and the whole front end are unaffected. That
is the payoff of having kept the sidecar stateless.

**Step 6 — The comparison slide.**
Run both models over the same 50 held-out photos and put the numbers side by
side: mAP, mean confidence, corrections-per-photo, inference time, and *classes
addable without retraining* (fine-tuned: 0. Open-vocab: unlimited). That table
is a better answer to "did you do any ML?" than any amount of talking.

### 6.3 Cutoff rule

If training is not producing usable results by the night before, **ship
open-vocabulary and say nothing about it.** A working demo of six ingredients
beats a broken demo of forty, every time. The fallback chain exists so that this
decision costs one environment variable.

---

## 7. The 500-word report

Rulebook §06: 500 words, on the template emailed after registration, delivered
**before your presentation slot**. §10 lists failure to submit as a
disqualification ground. Treat the deadline as the deadline.

### 7.1 Ready-to-submit draft (499 words, title included)

> **Leftover Chef — Cooking from what is already in your fridge**
>
> **Problem.** Roughly a third of the food produced for human consumption is
> never eaten. A large share of that loss is domestic: food bought with good
> intentions, forgotten behind something else, and thrown away days after it was
> still perfectly good. The failure is not indifference. It is that identifying
> what you have and finding a dish that matches it are two tedious tasks, and at
> the end of a working day most people do neither. They order food instead, and
> the vegetable drawer quietly spoils.
>
> **Solution.** Leftover Chef removes both tasks. The user photographs the inside
> of their fridge. A computer-vision model identifies the ingredients and returns
> them as labelled regions drawn over the photograph. The user confirms or
> corrects the list — a deliberate step, because an imperfect model must not
> silently edit somebody's kitchen — and the application then ranks every recipe
> it knows by two criteria simultaneously: how much of the dish can be prepared
> from what is already present, and how much of the user's soon-to-expire food
> the dish would consume. The result is not a search engine for recipes. It is a
> direct answer to "what should I cook tonight so that nothing is wasted?"
>
> **Technical approach.** The system comprises three local processes: a React
> front end, a Laravel REST API, and a Python inference service. Detection uses
> YOLO-World, an open-vocabulary object detector that accepts natural-language
> class prompts rather than a fixed trained class list. This is the project's
> central technical decision. Conventional detectors pretrained on COCO provide
> only five food categories; fine-tuning requires a labelled dataset and produces
> a model that cannot be extended without retraining. Our vocabulary of
> forty-nine fridge-specific classes is a configuration file, and extending it
> costs one line. Detected labels resolve to database ingredients through an
> alias table, so the vision vocabulary and the data model stay decoupled.
> Ranking combines match percentage and an explainable urgency score derived from
> stored use-by dates.
>
> **Constraints.** The exhibition venue provides no internet connection.
> Inference therefore runs entirely on the presenting laptop: model weights are
> cached locally, typography is bundled rather than fetched, nutrition
> calculation falls back to an internal dataset, and the database is
> file-based. Detection completes in approximately 200 milliseconds on CPU
> hardware with no GPU required. The complete demonstration path is verified by
> an automated offline rehearsal script.
>
> **Impact.** The project addresses UN Sustainable Development Goal 12,
> Responsible Consumption and Production, and specifically Target 12.3 on halving
> per-capita food waste. The waste-reduction mechanism is not an addendum to the
> application; it is the ranking function itself. Remove it and the project has
> no reason to exist. Each recommendation names the item it rescues and the days
> remaining, so users learn which foods they habitually lose, not merely what to
> cook.
>
> **Status.** Fully implemented and operational, covered by eighty-six automated
> tests, comprising a complete cooking platform: recipe library, meal planner,
> aisle-grouped shopping list, guided cooking mode with timers, and nutrition
> analysis.

### 7.2 How to adapt it

- If the template asks for sections you don't see here (objectives,
  methodology, results, conclusion), the paragraph headings above map cleanly:
  Problem → objectives, Solution + Technical approach → methodology, Constraints
  + Status → results, Impact → conclusion.
- **If you fine-tune before submission**, replace the last sentence of
  *Technical approach* with your measured numbers: *"A fine-tuned YOLOv8n
  variant trained on N annotated fridge images achieves mAP50 of X, and is used
  in preference to the open-vocabulary model where its class list applies."*
  Numbers beat adjectives.
- **Do not pad.** If the count comes in under 500, add a concrete detail, not an
  adverb.
- Have one person proofread it aloud. Every awkward sentence is audible.

---

## 8. SDG 12 and the CEP mapping

Rulebook §06 requires compliance with **the SDGs and Complex Engineering Problem
criteria**. Most teams will assert this in one line. Do it properly — it is free
marks and it takes a paragraph.

### 8.1 SDG alignment

| Goal | How it applies |
| --- | --- |
| **SDG 12 — Responsible Consumption and Production** (primary) | **Target 12.3**: halve per-capita global food waste at retail and consumer level. The expiry-weighted ranking is a direct consumer-level intervention. **Target 12.8**: information and awareness for sustainable lifestyles — the app shows *why* a recipe is recommended, teaching the habit rather than just serving it. |
| **SDG 2 — Zero Hunger** (secondary) | Household food security: making existing food go further has the same effect as buying more of it. |
| **SDG 13 — Climate Action** (secondary) | Food waste accounts for roughly 8–10% of global greenhouse gas emissions. Avoided waste is avoided emissions. |

### 8.2 Complex Engineering Problem attributes

| Attribute | How Leftover Chef satisfies it |
| --- | --- |
| **WP1 — Depth of knowledge** | Requires knowledge beyond routine application: convolutional object detection, vision-language embedding models (CLIP text encoders), multi-criteria ranking design, distributed process architecture, relational schema design. |
| **WP2 — Range of conflicting requirements** | Detector accuracy versus extensibility (fine-tuned vs open-vocabulary); automation versus user control (auto-add vs confirm step); offline operation versus model size; ranking by cookability versus ranking by urgency. Each was resolved explicitly and documented. |
| **WP3 — Depth of analysis** | No obvious solution. The ranking function required deriving an urgency curve, a diminishing-returns aggregation, and a weighting between two incommensurable quantities — then constraining all three to remain explainable to a non-technical user. |
| **WP4 — Familiarity of issues** | Goes beyond issues covered in standard coursework: zero-shot detection, model weight provisioning for air-gapped deployment, graceful degradation of an ML component. |
| **WP5 — Extent of applicable codes** | No standard covers "rank recipes by food-waste avoidance". The team defined the metric, its bounds, its failure behaviour and its test criteria. |
| **WP6 — Stakeholder involvement** | Home cooks (want speed), the environment (wants waste reduction), and the exhibition context (demands reliability with no internet) impose conflicting requirements; the confirm step and the offline architecture are the reconciliations. |
| **WP7 — Interdependence** | Three interdependent subsystems — vision inference, API/data layer, client. A change in the detector vocabulary propagates through the alias table into ranking and the UI, which is precisely why the vocabulary was made data rather than code. |

---

## 9. Demo script and judge Q&A

### 9.1 The three-minute run

Have it **already running** before they arrive — the rulebook gives no extra
time. Open on the demo cook, signed in.

| Time | Beat | What you say |
| --- | --- | --- |
| 0:00 | **The shelf is already showing** "4 items to use up tomorrow" | *"This is my fridge. Four things in it die within three days."* |
| 0:20 | **Click a saved photo.** Boxes land with labels and confidences | *"One photo. That's the whole input."* — then **stop talking** and let them look |
| 0:45 | **Point at the footer**: `open-vocabulary · yolov8s-worldv2.pt · 8 detections in 475 ms · on this laptop` | *"No cloud. That ran here, in under half a second, on CPU."* |
| 1:05 | **Drop a wrong chip. Add a missing one.** | *"The model proposes. The cook decides. A 70%-accurate model behind a confirm step is a 100%-reliable product."* |
| 1:25 | **Confirm.** Results reorder live | *"Two of these I can cook right now — and it dated the perishables itself, so I never typed a use-by date."* |
| 1:45 | **Point at the top card** | *"This one is first at 78% — below a 100% match — because it uses the spinach that dies tomorrow. Seventy percent cookability, thirty percent waste avoided. You can check the arithmetic; it's on the card."* |
| 2:15 | **Start cooking.** Timer running | *"Steps with timers parsed out of the instructions."* |
| 2:35 | **The close** | *"A third of the world's food is never eaten. Most of it dies in a fridge like this one. That's SDG 12, and it's the ranking function, not the tagline."* |
| 2:50 | **The kill shot, if they linger** | *"Would you like me to turn the WiFi off and do it again?"* |

**Rules for the run:** one person drives, one narrates, one watches the laptop.
Never apologise for a wrong detection — drop it and say *"that's what the confirm
step is for."* Never say "it should…". If something breaks, move to the next
beat; do not debug on stage.

### 9.2 Questions you will be asked

**"Did you train the model yourselves?"**
> No, and that was the decision. COCO-pretrained gives five usable food classes;
> fine-tuning gives you a model frozen to whatever you labelled. We used
> YOLO-World, which takes text prompts, so our vocabulary is a JSON file — 49
> classes, and adding one is a line. We have the fine-tuning pipeline planned as
> the next step, running ahead of this model with this one as fallback. *(Then
> open `vocabulary.json`.)*

**"What's your accuracy?"**
> On the product metric that matters — corrections per photo — usually one or
> two. But we designed on the assumption the model is wrong sometimes, which is
> why nothing is written until the cook confirms. An accuracy number would be
> reassuring and slightly dishonest; the confirm step is what actually makes it
> reliable.

**"What happens with no internet?"**
> Nothing happens. Shall I show you? *(Turn WiFi off. Rescan.)*

**"What if it detects nothing?"**
> Then you type. The ingredient picker is right there, the fridge is saved
> between visits, and every other feature works. The camera saves you typing —
> it isn't a gate.

**"Isn't this just a recipe app?"**
> A recipe app answers "how do I make X". This answers "what should I make so
> nothing gets thrown away", which is a different question and needs different
> data — use-by dates, and a ranking that weighs them.

**"What was the hardest part?"**
> Two things. Getting a detector that knows fridge items without a training run.
> And a bug in the inherited code: ingredient search matched on slug and never
> consulted the alias table, so anything the detector called `capsicum` or
> `jeera` silently vanished — no error, just recipes quietly not matching. That
> one taught us that the dangerous bugs are the ones that don't throw.

**"Where do the expiry dates come from — does the model see them?"**
> No, and it would be a stretch to claim it could. They come from a shelf-life
> table: spinach three days, chicken two, garlic sixty. It is a starting guess,
> it is marked on screen with a tilde so nobody mistakes it for a fact, and one
> tap corrects it. The alternative was asking somebody to type twelve dates
> after every scan, which means the feature never gets used.

**"How would you deploy this for real?"**
> Docker Compose is in the repo — the web tier runs against PostgreSQL. The
> detector deliberately isn't containerised, because on a phone it belongs
> on-device; the browser path is ONNX Runtime Web, which is the next
> architectural step.

**"What would you do with more time?"**
> Estimate use-by dates automatically at scan time, so the one manual step
> disappears. Then a waste-avoided counter, so the impact is a number on screen
> instead of a claim in a report.

---

## 10. Additional suggestions

Things worth doing that nobody has asked for.

### Presentation

1. **A one-page A3 poster at the desk.** Judges circulate; half your audience
   sees the desk before they see you. Architecture diagram, the ranking formula,
   the SDG line, three screenshots. It works while you are talking to somebody
   else.
2. **A 40-second screen recording on loop** on a phone propped at the desk, for
   when the queue backs up.
3. **Print the ranking formula on a card** and leave it on the table.
   `0.7 × match% + 0.3 × use-it-up`. Judges photograph things like that.
4. **Have a second laptop or a phone** showing the repo — a clean commit history
   with real messages is evidence of process, and it is scoreable under "clean
   code".
5. **Practise the failure.** Deliberately scan something that detects badly and
   recover from it in your rehearsal. If it happens live you will look
   unbothered, because you will have been there.

### Product

6. **Show the waste number.** Nothing lands harder than *"this fridge is 4 items
   away from a bin bag"*. Even a static computed figure on the shelf card.
7. **A "why this recipe" tooltip** spelling out the arithmetic:
   `78% match (7 of 9 ingredients) × 0.7 = 54.6, use-it-up 86 × 0.3 = 25.8 →
   priority 80`. Transparency is a feature, and it directly serves the
   "implementation" and "design" criteria at once.
8. **Empty-state copy that teaches.** The first-run screen should say what the
   app is *for*, not what to click.
9. **Keyboard shortcuts in cook mode.** Space to advance a step. Anyone actually
   cooking has wet hands and one elbow free.

### Engineering

10. **Add `LC_BACKEND` to the demo checklist** so you can force the COCO
    fallback in ten seconds if the world weights misbehave.
11. **Snapshot the seeded database** (`database/database.sqlite` copied to
    `database/demo.sqlite`) so a catastrophic mid-demo state can be restored with
    a file copy instead of a re-seed.
12. **Pin the Python and Node versions** in the README. "Works on my machine" is
    the most common way a second laptop fails.
13. **Screenshot tests are overkill, but one smoke test that boots all three
    processes in CI would not be** — it is the only thing currently unguarded by
    an automated check.
14. **Log every scan's detection count and elapsed time to a file.** After a day
    of judges photographing your fridge you will have a genuine dataset of
    real-world performance — and the beginnings of §6's training set.

### If you want a research angle

15. **Freshness classification** (§5, Tier 2) is the one idea here that is not
    in any shipping product. *Is this tomato still good* is an open problem, has
    obvious social value, and a small labelled dataset would go a long way. If
    anyone on the team wants a thesis topic, that is it.

---

## 11. Risk register

| Risk | Likelihood | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- |
| Detector produces poor results on hall lighting | Medium | High | Saved photos are the primary path; webcam is optional. Confirm step absorbs errors. | **Mitigated** |
| Model weights missing on the venue laptop | Low | Fatal | `warm-cache.ps1` at home; `offline-check.ps1` verifies | **Mitigated, needs the rehearsal run** |
| Something silently needs internet | Medium | Fatal | `offline-check.ps1` with WiFi off | **Untested on the venue laptop** |
| Report not submitted before the slot | Low | Disqualification | §7 draft is ready; submit early | **Open** |
| One of three processes fails to start | Medium | High | `start-demo.ps1` polls each and reports; `-SkipVision` runs the app without the detector | **Mitigated** |
| A port is already occupied | Medium | Medium | `stop-demo.ps1` frees by port | **Mitigated** |
| Laptop battery / power | Medium | Fatal | Multi-plug is **mandatory** per rulebook §07. Bring it. | **Open** |
| Guest visitor sees "0 recipes" after scanning the bundled sample | **High** | Medium | Replace with real fridge photos | **Open — Tier 0 item 1** |
| Demo account expiry dates read as stale | Low | Medium | Dates are relative; re-seed the morning of | **Mitigated** |

---

## 12. Numbers cheat sheet

Memorise five of these. They make answers sound like measurements.

| | |
| --- | --- |
| Recipes seeded | **32**, across **23 countries** and **9 world regions** |
| Ingredient vocabulary | **92 ingredients**, **290 recipe-ingredient links**, 26 staples, **50 with a shelf life** |
| Detector classes | **49**, zero-shot, extensible by one line of JSON |
| Detection time | **~190–475 ms** per photo, **CPU only**, no GPU |
| API surface | **55 endpoints** |
| Front end | **14 screens**, React 19 + Tailwind 4 |
| Automated tests | **86 tests, 225 assertions**, all passing |
| Application code | **~17,000 lines** across PHP, JSX, Python and PowerShell |
| Model cache | **~390 MB**, fully local |
| Processes to start | **3**, via **1** command |
| Ranking weights | **0.7** cookability · **0.3** waste avoided |
| Urgency horizon | **7 days** |
| Demo fridge | **25 items**, **4** expiring within 3 days |

---

*Last updated 8 September 2026. Keep this current — a dossier that has drifted
from the code is worse than none.*
