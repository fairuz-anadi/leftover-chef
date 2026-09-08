# Leftover Chef

*Photograph your fridge. Cook what's about to die.*

Point a camera at the inside of your fridge. A vision model names what it sees,
you confirm the list, and Leftover Chef ranks every recipe it knows by two
things at once: **how much of it you can already make**, and **how much of your
about-to-expire food it would use up**.

Everything runs on the laptop. No cloud vision API, no internet at any point
after setup.

Built for the **AUST CSE Carnival 8.0 — Software & AI project exhibition**,
9 September 2026.

---

## Team

| ID          | Name              | Role      |
|-------------|-------------------|-----------|
| 20230104123 | Easteak Ahmed     | Lead      |
| 20220204061 | Saleh Mahmud Sami | Front-end |
| 20230104121 | Fairuz Anadi      | Back-end  |

---

## Why it matters

Roughly a third of the food produced for people to eat is never eaten. Most of
that loss happens quietly, in domestic fridges, to things that were perfectly
good four days ago. The reason is rarely indifference — it is that at 7pm
nobody wants to audit a vegetable drawer and then go looking for a recipe that
matches it.

Leftover Chef removes both steps. One photo replaces the audit; the ranking
replaces the search. **SDG 12 — Responsible Consumption and Production.**

---

## What it does

- **Fridge Scan** — photo, webcam or a saved shot; detections come back drawn
  as labelled boxes over your own picture.
- **Confirm before anything happens** — every detection is a removable chip
  with its confidence. Nothing reaches your fridge until you say so.
- **Ranked recipes** — grouped into *cook right now* and *almost there*, with
  the missing ingredients named.
- **Use It Up** — a shelf that says *"4 items to use up tomorrow"*, and recipes
  scored on how much of that they rescue, with the reason on the card.
- **Use-by dates estimated for you** — confirming a scan dates the perishables
  from typical shelf life, so the ranking works without anyone typing a date.
  Guesses are marked with a `~`; cupboard staples get no date at all.
- Plus the platform underneath: a 32-recipe library, cuisine map, guided cook
  mode with timers, meal planner, auto shopping list, nutrition estimates,
  profiles with diets and allergies, reviews and an admin dashboard.

---

## Quick start

Requires **PHP 8.2+**, **Composer**, **Node 20+** and **Python 3.10+** on PATH.

```powershell
.\scripts\setup.ps1        # once, with internet — deps, database, model weights
.\scripts\start-demo.ps1   # every time after — three processes, one command
```

That opens <http://localhost:5173/fridge>.

**Demo login:** `demo@leftoverchef.test` / `DemoPass123!`
**Admin login:** `admin@leftoverchef.local` / `AdminPass123!`

### Doing it by hand

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve                              # :8000

cd client && npm install && npm run dev        # :5173

cd vision
python -m venv .venv --system-site-packages
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python app.py                    # :8001
```

---

## Architecture

```
   React 19 + Tailwind 4          Laravel 10 API             FastAPI + YOLO-World
   localhost:5173      ───────>   localhost:8000   ───────>  localhost:8001
   photo, boxes, chips            matching, ranking          detection only
                                        │
                                        └── SQLite
```

The browser never talks to the detector directly — Laravel proxies, so there is
one origin and one auth story, and the sidecar stays a stateless "image in,
boxes out" service.

### The detector

**YOLO-World**, open-vocabulary, zero-shot. Instead of a fixed class list it
takes text prompts, so `vision/vocabulary.json` asks it for *"carton of milk"*,
*"green chilli pepper"*, *"tin of tomatoes"* — 49 prompts covering the things
that are actually in a fridge, with no fine-tuning and no labelled dataset.
Adding an ingredient is one line of JSON.

COCO-pretrained YOLOv8n is kept as an automatic fallback (`LC_BACKEND=coco`),
but it only knows five foods out of its eighty classes, which is why it is the
fallback.

**~190 ms per photo on CPU.** No GPU required.

Detector labels become ingredient rows through the **alias table** in
`IngredientSeeder` — there is no mapping code in PHP, and there should not be.

### The ranking

```
priority_score = 0.7 × match_percent  +  0.3 × use_it_up_score
```

`use_it_up_score` rises as food gets closer to its date, counts the most urgent
item in full and each further one at half the last, and only counts ingredients
you actually hold. Arithmetic, not learned — the card shows the number *and*
the reason, so it can be checked on the spot. With no expiry dates set, the
second term is zero and the ranking is plain match percentage.

---

## Offline

The venue provides no internet, so:

- model weights live in `vision/weights` (~390 MB, fetched once by
  `scripts/warm-cache.ps1`)
- fonts are bundled, not pulled from a CDN
- nutrition falls back to a built-in per-100g table when no API key is set
- SQLite means no database server to bring up

Rehearse it properly — turn WiFi **off**, then:

```powershell
.\scripts\offline-check.ps1
```

It walks the whole judge-visible path — detector loaded from local weights, API
answering, a real photo scanned, aliases resolving, recipes ranked — and
reports anything that quietly wanted the network.

---

## Tests

```bash
php artisan test           # 86 tests
cd client && npm run lint
```

`FridgeScanTest` covers detector-label mapping, chip collapsing, unknown
labels, and that a scan never writes to the fridge on its own.
`UseItUpRankingTest` covers urgency, the expiring shelf, diminishing returns,
and that the published score matches the running order. `ApiErrorShapeTest`
pins every `/api` route to JSON status codes, with and without an `Accept`
header — a redirect where a 401 belongs is the kind of thing only a network tab
reveals. `ExpiryEstimationTest` covers the shelf-life catalog and every rule
about when a date may and may not be guessed.

---

## Scripts

| Script | What it does |
| --- | --- |
| `setup.ps1` | One-time: PHP + npm + Python deps, database, model weights |
| `start-demo.ps1` | Starts all three processes, waits for each, opens the browser |
| `stop-demo.ps1` | Frees ports 5173 / 8000 / 8001 |
| `warm-cache.ps1` | Pulls every model file while you still have WiFi |
| `offline-check.ps1` | The rehearsal — run it with the network off |

---

## Demo photos

Drop 3–4 fridge photos into `client/src/assets/demo-photos/` and they appear as
thumbnails in the scan panel — no manifest to update. See the README in that
folder for what makes a good one. Webcam under hall lighting is a coin flip;
saved photos are the primary path.

---

## Further reading

**[context.md](context.md)** — the engineering record: design decisions and why
they were made, the bug the alias table depended on, and what is done and what
is not.

**[docs/PROJECT-DOSSIER.md](docs/PROJECT-DOSSIER.md)** — the exhibition
dossier: the full feature inventory, the roadmap including the fine-tuning
pipeline, a ready-to-submit 500-word report, the SDG and CEP mapping, the
three-minute demo script and the questions judges ask.
