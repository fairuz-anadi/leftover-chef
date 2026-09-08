# context.md

Working notes for **Leftover Chef** — what it is, how the pieces fit, and why
they are the way they are. This is the file to read before changing anything
structural, and the file to update when you do.

For the exhibition side of things — feature inventory, roadmap, the 500-word
report, SDG/CEP mapping, demo script and judge Q&A — see
[docs/PROJECT-DOSSIER.md](docs/PROJECT-DOSSIER.md).

**Last updated:** 8 September 2026

---

## 1. What this is

Photograph the inside of your fridge. A vision model names what it sees, you
confirm the list, and the app ranks every recipe it knows by two things at
once: how much of it you can already make, and how much of your
about-to-expire food it would use up.

Built for the **AUST CSE Carnival 8.0 — Software & AI project exhibition**
(9 September 2026, onsite at AUST). SDG 12, Responsible Consumption, is the
point rather than a footnote: the ranking exists to stop food being thrown
away.

Built on top of the FridgeToFork codebase — the recipe library, cuisine map,
meal planner, guided cook mode, shopping list and nutrition estimator were
already there. What is new here is the camera, the expiry ranking, and the
offline demo rig around both.

**Team:** Easteak Ahmed (lead) · Saleh Mahmud Sami (front-end) ·
Fairuz Anadi (back-end).

---

## 2. The one constraint that shaped everything

> *"No internet connection will be provided at the venue."* — rulebook, §07

Not a detail. It rules out every cloud vision API, and it is why the
architecture looks the way it does:

| Decision | Because |
| --- | --- |
| Detector is a local Python process, not an API call | No network at the desk |
| Model weights cached in `vision/weights` | ~390 MB, fetched once at home |
| SQLite by default | No database server to bring up |
| Fonts bundled via `@fontsource`, not a CDN | A blocked font request is a broken-looking demo |
| Nutrition falls back to a local per-100g table | Spoonacular/Edamam keys are optional |
| `scripts/offline-check.ps1` | Rehearsing it is the only way to know |

Pull the network cable and everything still works. That is a deliberate
position and it is worth saying out loud to a judge, because most projects in
the hall will be one dead API call away from a blank screen.

The rulebook also decides the schedule: the project must be **running before
the judges arrive** and no extra time is given if it is not. Hence
`start-demo.ps1` — one command, three processes, waits for each to answer.

---

## 3. Shape of the system

Three processes, all on localhost:

```
   React 19 + Tailwind 4          Laravel 10 API             FastAPI + YOLO-World
   localhost:5173      ───────>   localhost:8000   ───────>  localhost:8001
   photo, boxes, chips            matching, ranking          detection only
                                        │
                                        └── SQLite (database/database.sqlite)
```

The browser never talks to the sidecar. Laravel proxies, so there is one
origin, one auth story, and the sidecar can stay a dumb, stateless "image in,
boxes out" service with no database and no idea what an ingredient is.

### The request that matters

1. `POST /api/pantry/scan` — the photo arrives at Laravel as multipart.
2. `VisionClient` forwards it to the sidecar, which returns
   `{label, ingredient, confidence, box}` per detection, in the photo's own
   pixel frame.
3. `DetectionMapper` resolves each `ingredient` to a row via
   `Ingredient::lookup()`, collapses repeats to one chip (keeping every box),
   and reports anything unresolvable under `unmatched` rather than dropping it.
4. The client draws the boxes over the photo and shows a chip per ingredient.
5. **Nothing has been written yet.** The cook drops what is wrong, then
   `POST /api/pantry/scan/confirm` puts the survivors in the fridge.

---

## 4. The detector

**YOLO-World (`yolov8s-worldv2.pt`), open vocabulary, zero-shot.**

This is the decision most worth explaining. The obvious route — COCO-pretrained
YOLOv8n — gives you five usable food classes out of eighty (`banana, apple,
orange, broccoli, carrot`). Useless for a fridge. The plan's answer was to
fine-tune on a Roboflow fridge dataset, which means finding a dataset, an hour
of GPU time, and a model that knows exactly the classes it was trained on.

YOLO-World takes a **list of text prompts** instead of a fixed class list. You
hand it `"carton of milk"`, `"green chilli pepper"`, `"tin of tomatoes"` and it
finds them, having never been trained on your kitchen. `vision/vocabulary.json`
holds 49 such prompts. Adding an ingredient is one line of JSON and a restart —
no retraining, no labelling, no dataset.

Cost: it needs the CLIP text encoder (~350 MB) to turn prompts into embeddings.
That is cached in `vision/weights/clip/` and pinned there by `_pin_clip_cache()`
in `detector.py`, because ultralytics would otherwise put it in a global
directory outside the project — which is exactly the kind of thing that works
on your laptop and not on demo day.

Measured: **~190 ms per photo on CPU** at 640px, 1600×1067 input. No GPU
needed.

**The fallback still exists.** `LC_BACKEND=coco` forces plain YOLOv8n, and the
sidecar falls back to it on its own if the world weights will not load. Fewer
classes, same response shape, demo survives.

### How a detector label becomes an ingredient row

Through the **alias table**, and nothing else. `vocabulary.json` says
`"tin of tomatoes" → "Chopped Tomatoes"`; `IngredientSeeder` lists
`'tin of tomatoes'` among that row's aliases; `Ingredient::lookup()` does the
rest. There is no mapping code in PHP and there should never be one — adding a
detector class means adding an alias.

> **Bug this depended on.** `PantryMatchService::resolveIngredientIds()` used to
> query `whereIn('slug', …)` and never call `lookup()`, so the alias table was
> ignored on the search path. A detector emitting `capsicum` vanished silently —
> no error, just a missing ingredient and recipes that quietly stopped matching.
> Fixed; `FridgeScanTest::test_detector_labels_resolve_through_the_alias_table`
> and the `offline-check` alias step both guard it now.

### Every /api response is JSON

`Handler::render()` used to delegate to the framework handler whenever the
caller had not sent `Accept: application/json`. That handler redirects
unauthenticated callers to `route('login')` — a route this app does not have,
because the front end is React. The result was a **500 where a 401 belonged**,
on the client's own boot-time `GET /api/me`, on every single page load. The UI
never showed it (the boot code catches everything), which is exactly why it
survived: it was only visible in a network tab, which is where a judge looks.

It now keys off the path — `/api/*` is an API and has no HTML to serve — so
auth failures are 401 and validation failures are 422 regardless of what the
caller asked for. `ApiErrorShapeTest` covers both header cases across six
endpoints. `api.js` also sends the header now; either fix alone is sufficient,
and having both means a curl or a phone gets the same answers as the client.

---

## 5. The confirm step

Detections never flow straight into results. They become removable chips with
their confidence, and the cook presses a button.

This reads as careful UX, and it is — but it is also the single thing that
turns a 70%-accurate model into a 100%-reliable demo. If the model misses the
eggs, you tap "+ Egg" and nobody watching sees a failure. If it hallucinates an
orange, you tap it away.

It is also just correct. The cook is standing in front of their own fridge.
They know what is in it. The model's job is to save them the typing, not to
overrule them.

**Do not remove this step.** Everything else in the plan's cut list can go
first.

The scan panel spans the full page width rather than sitting in the sidebar,
and splits into photo-left / chips-right once a result is in. It started in the
380px column and the boxes were unreadable at that size, which defeats the
point of drawing them. Box labels also flip to the inside of the box when it is
against the top edge of the photo — fridge shelves put things there constantly,
and a label clipped by the container is a detection nobody can read.

---

## 6. Use It Up — the expiry ranking

`pantry_items.expires_on` was in the schema from the start and nothing read it.
That is now half the pitch.

**`UseItUpService`** turns dates into numbers:

- `urgency(days_left)` — straight line from 1.0 (today or overdue) to 0.0 at
  the 7-day horizon. Already-expired food still scores 1.0 rather than
  disappearing: whether yesterday's spinach is a salad or a bin job is the
  cook's call, and hiding it helps nobody.
- `score(ingredients, urgency)` — the most urgent rescue counts in full, each
  further one adds half of what the last one added. Three items beat one, but
  not by three times, so a kitchen-sink recipe cannot win on volume.
- Only ingredients the cook **actually holds** and that still have urgency to
  lose count as a rescue. A recipe does not save your spinach by listing
  spinach you would have to buy, and an onion three weeks out is not being
  saved from anything.

**`PantryMatchService::priority()`** combines the two halves:

```
priority_score = 0.7 × match_percent  +  0.3 × use_it_up_score
```

Deliberately arithmetic, not learned. The card shows the number *and the
reason* — "Uses up Spinach (tomorrow)" — so a judge can check the maths on the
spot. And with no expiry dates anywhere in the fridge, the second term is 0 for
every recipe and the ranking collapses back to plain match percentage: nothing
changes for a cook who never sets a date.

On the seeded demo account this produces the story the pitch needs:

```
Kiwi Green Breakfast Hash    match  78%   use-it-up 86   priority 80   Spinach (tomorrow)
Spaghetti Aglio e Olio       match 100%   use-it-up 14   priority 74   Green Chilli (6d)
Shakshuka                    match  89%   use-it-up 38   priority 74   Tomato (4d), Bell Pepper (5d)
```

---

### Estimating the date nobody wants to type

A scan adds a dozen ingredients in one tap. Asking the cook to then set twelve
use-by dates by hand is how a feature gets ignored, and an ignored expiry field
means the entire waste-ranking half of the app does nothing. So food arriving
without a date gets one proposed from `ShelfLifeCatalog` — spinach 3 days,
chicken 2, garlic 60 — applied on scan confirm, on manual add, and on the sync
endpoint, so the shelf behaves the same however it was stocked.

Three rules keep it honest:

- **It only ever fills a blank.** An explicit date in the request wins, and
  anything already on the shelf keeps the date the cook gave it even if a later
  scan sees it again.
- **It never invents a date for things that do not expire.** 50 of the 92
  ingredients have a shelf life; salt, rice, oil and every spice have `null`. A
  countdown on the salt is noise, and noise dilutes the shelf that is supposed
  to mean "cook this tonight".
- **A guess is labelled as a guess.** `pantry_items.expiry_estimated` drives a
  tilde and a dashed border on the chip — `~in 5 days` versus `in 5 days` — and
  the confirmation toast says how many dates were estimated. The moment anyone
  edits one, including clearing it, it stops being an estimate.

The numbers live in `app/Support/ShelfLifeCatalog.php` rather than as a tenth
column on every `IngredientSeeder` row: they are the kind of value that gets
argued over and revised, and they should read as a list. Ingredients invented on
the fly by `Ingredient::resolve()` have no seeded value and fall back to an
aisle default.

---

## 7. Where things live

```
context.md                  this file
README.md                   how to run it
scripts/
  setup.ps1                 one-time: deps, database, weights
  start-demo.ps1            three processes, waits for each, opens the browser
  stop-demo.ps1             frees the three ports
  warm-cache.ps1            pull every model file while you still have WiFi
  offline-check.ps1         the rehearsal — run it with WiFi OFF

vision/                     the sidecar (no database, no state)
  app.py                    FastAPI: GET /health, POST /detect
  detector.py               backend selection, inference, dedupe, CLIP pinning
  vocabulary.json           49 prompts → canonical ingredient names
  weights/                  gitignored, ~390 MB, fetched by warm-cache.ps1

app/Support/
  ShelfLifeCatalog.php      how long each ingredient keeps, by slug then aisle

app/Http/Services/
  VisionClient.php          HTTP to the sidecar, degrades to a clear 503
  DetectionMapper.php       detections → ingredient rows, dedupe, unmatched
  UseItUpService.php        expiry → urgency → rescue score
  PantryMatchService.php    recipe matching + priority ranking

app/Http/Controllers/
  FridgeScanController.php  POST /api/pantry/scan, GET /api/pantry/scan/status
  PantryController.php      the fridge: add, confirm scan, set dates, expiring

client/src/
  components/FridgeScan.jsx the scan panel: sources, boxes, chips, confirm
  pages/PantryPage.jsx      fridge + Use It Up shelf + ranked results
  assets/demo-photos/       drop photos here, they appear automatically
```

### New API surface

| Method | Path | Auth | What |
| --- | --- | --- | --- |
| `GET` | `/api/pantry/scan/status` | — | Is the detector up, and on which backend |
| `POST` | `/api/pantry/scan` | — | Photo → candidate ingredients + boxes |
| `POST` | `/api/pantry/scan/confirm` | yes | Commit confirmed chips (additive) |
| `GET` | `/api/pantry/expiring` | yes | The "cook this tonight" shelf |
| `PATCH` | `/api/pantry/{item}` | yes | Set or clear a use-by date (and clear the estimated flag) |

`POST /api/pantry/search` gained `use_it_up_score`, `rescues` and
`priority_score` per match, and `expiring_soon` / `rescues_waste` in `meta`.

### Schema changes

`2026_09_07_000015_add_scan_provenance_to_pantry_items_table`
adds `source` (`manual` / `scan` / `seed`), `detected_as` and `confidence`.
Worth storing rather than inferring — the chip shows a 📷 for camera-added
items, and `detected_as` keeps the raw label for when a mapping looks wrong and
someone has to work out why.

`2026_09_08_000016_add_shelf_life_estimation` adds `ingredients.shelf_life_days`
and `pantry_items.expiry_estimated`. Both nullable/defaulted, because salt does
not expire and a column that forced a number would invent one.

---

## 8. Running it

```powershell
.\scripts\setup.ps1        # once, with internet
.\scripts\start-demo.ps1   # every time after
```

Demo login: `demo@leftoverchef.test` / `DemoPass123!` — a fridge with 25 items,
four of them expiring inside three days, a half-filled week and some reviews,
so every screen opens populated.

Expiry dates in `DemoCookSeeder` are **relative** (`addDays(2)`), not fixed. A
hardcoded date would read as "expired 400 days ago" by the time anyone sees it.
Re-seed on the morning of and the shelf is correct.

---

## 9. State of things

**Done and verified**

- Alias-lookup bug fixed; `capsicum` → Bell Pepper, `jeera` → Cumin.
- YOLO-World sidecar, 49-class vocabulary, both backends cached offline.
- `POST /api/pantry/scan` end to end: photo → 8 detections → 6 ingredients in
  188 ms → ranked recipes.
- Scan UI: upload / webcam / saved photos, boxes over the photo, confidence
  chips, click a box to drop its chip, confirm before anything is written.
- Use It Up: dates on chips, the expiring shelf, rescue reasons on cards.
- `/api/*` answers 401/422 in JSON instead of 500/302 — see §4.
- Run for real in a browser, signed out and signed in: sample photo scans in
  ~475 ms, chips carry "have" badges against the saved fridge, the shelf reads
  "4 items to use up tomorrow", and the ranked list puts a 78% match that
  rescues tomorrow's spinach above an 82% one that rescues nothing.
- Expiry estimation on scan: confirming a photo dates the perishables from
  `ShelfLifeCatalog`, marks the guesses, and leaves cupboard staples undated.
- 86 PHPUnit tests pass, 42 of them new. `npm run build` clean, eslint clean.

**Not done**

- **Demo photos.** The one that ships in `client/src/assets/demo-photos/` is a
  food-styling shot, not a fridge: it detects six things happily but they do
  not combine into any recipe, so the results panel reads "0 recipes you can
  make". Fine for proving the detector, useless as the demo. Take 3–4 real
  fridge photos — see the README in that folder. **This is the highest-value
  hour left**, and nothing else on this list comes close.
- **The offline rehearsal has not been run on the venue laptop.** Everything is
  local by construction and `offline-check.ps1` exists, but "should work
  offline" and "we watched it work offline" are different claims and only one
  of them is worth making to a judge.
- **The 500-word project report** (rulebook §06) must reach the organisers
  before the presentation slot. Failing to submit it is grounds for
  disqualification.

**Deliberately not done**

- ONNX Runtime Web (detection fully in-browser). Better story, too much
  integration risk this close. The sidecar already runs on the laptop, which is
  the property that actually matters.
- Fine-tuning on a Roboflow dataset. Open-vocabulary made it unnecessary; see §4.

---

## 10. Demo script, three minutes

1. Open on the demo cook. The **Use It Up shelf** is already saying "4 items to
   use up tomorrow".
2. **Snap the fridge** — pick a saved photo. Boxes land on the image with
   labels and confidences, and the footer says *open-vocabulary ·
   yolov8s-worldv2.pt · 8 detections in 188 ms · on this laptop*.
3. **Drop a wrong chip, add a missing one.** Say why out loud: the model
   proposes, the cook decides.
4. **Confirm.** Results reorder live. "You can cook four of these right now."
5. **Point at a card.** "This one is first because it uses the spinach that
   dies tomorrow — 78% match, use-it-up 86." Explain the 70/30 split.
6. **Start cooking** — guided cook mode with the timer running.

If asked *"what happens with no internet?"*: turn the WiFi off and do it again.

---

## 11. Notes for whoever picks this up

- There is an earlier port of this idea at `D:\leftover-chef` from a previous
  session — COCO-only detector, no expiry ranking. This project supersedes it.
  Do not merge them; take anything you want by hand.
- `vision/weights` is gitignored and ~390 MB. A fresh clone needs
  `scripts/warm-cache.ps1` **with internet** before it can detect anything.
- The sidecar binds to `127.0.0.1` on purpose. Do not open it to `0.0.0.0` to
  "make the phone work" — put the phone through Laravel.
- `UserFactory` was missing `username`, which is `NOT NULL UNIQUE`, so the
  stock factory could not create a user at all and every older test hand-rolled
  `User::create()`. Fixed; new tests use the factory.
- If a scan returns nothing, check `GET /api/pantry/scan/status` first. Nine
  times out of ten the sidecar is not running, and the UI says so in a banner
  rather than failing silently.
