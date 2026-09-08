# Leftover Chef

### A smart fridge companion — detect, track, and cook before it spoils

*"We built a fridge that thinks for you — point your phone, and it tells you what
to eat before it's too late."*

Photograph the inside of your fridge. A vision model names what is in it, the
app tracks how long each thing has left, warns you when something is about to
go, and tells you what to cook with it. Everything runs on the laptop — no
cloud, no accounts, no internet.

Built for the **AUST CSE Carnival 8.0 — Software & AI segment**, 9 September 2026.

---

## Team

| ID          | Name              | Role      |
|-------------|-------------------|-----------|
| 20230104123 | Easteak Ahmed     | Lead      |
| 20220204061 | Saleh Mahmud Sami | Front-end |
| 20230104121 | Fairuz Anadi      | Back-end  |

---

## The problem

Every day people stand in front of a fridge unsure what to cook — and
separately, food quietly expires at the back of it because nobody is tracking
it. These are the same problem: **no visibility into what you own and how
urgently you need to use it.**

Competing expiry-tracker apps make you type in every item and every date, and
people abandon them inside a week. Here the camera does the logging.

---

## The loop

```
   detect  ──▶  track  ──▶  warn  ──▶  cook  ──▶  measure
   photo        shelf       push       recipe     waste saved
                life        alert      match      counter
```

Most student projects build one link in that chain. This one closes it.

1. **Fridge photo scan** — photograph the shelf; the detector names the
   ingredients and draws them on your own picture. You confirm before anything
   is logged.
2. **Auto shelf-life estimation** — each item gets a use-by date from a
   food-science lookup table. Spinach three days, chicken two, garlic sixty. No
   typing.
3. **Tiered freshness** — 🟢 Fresh · 🟡 Use soon · 🔴 Use today, as a badge and
   an animated countdown bar on every item.
4. **Recipe suggestions** — ranked by how much of the dish you already have and
   how much at-risk food it would use up, with Bangladeshi cooking weighted up.
5. **Fridge health dashboard** — a ring showing how much of what you own is
   still good.
6. **Notification simulation** — a *fast-forward a day* button moves the whole
   app's clock; anything that crosses into 🔴 raises the alert instantly.
7. **Food-waste-saved counter** — a running tally of ingredients used before
   they spoiled, against sample households on a small leaderboard.

Plus **Recipe Reveal** (your fridge photo beside the finished dish), a **voice
assistant** that answers "what can I make for dinner?" aloud, **"what am I
missing?"**, and manual correction of anything the model gets wrong.

---

## Quick start

Requires **PHP 8.2+**, **Composer**, **Node 20+** and **Python 3.10+** on PATH.

```powershell
.\scripts\setup.ps1        # once, with internet — deps, database, model weights
.\scripts\start-demo.ps1   # every time after — three processes, one command
```

Opens <http://localhost:5173>. **There is no login** — the fridge belongs to the
browser session, and a new visitor opens on a stocked demo fridge.

### By hand

```bash
composer install && cp .env.example .env && php artisan key:generate
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
   React 19 + Tailwind 4        Laravel 10 API          FastAPI + YOLO-World
   localhost:5173      ─────▶   localhost:8000  ─────▶  localhost:8001
   one screen                   tracking, ranking       detection only
                                      │
                                      └── SQLite
```

The browser never talks to the detector — Laravel proxies, so the sidecar stays
a stateless "image in, boxes out" service that knows nothing about ingredients.

**Detection** is YOLO-World, open-vocabulary: it takes text prompts instead of a
fixed class list, so `vision/vocabulary.json` asks it for *"carton of milk"* and
*"tin of tomatoes"* — 49 fridge classes with no labelled dataset. Every
ingredient also carries its Bengali name, shown beside the English one. Roughly
**200 ms per photo on CPU**, no GPU. Detector labels reach ingredient rows
through the alias table in `IngredientSeeder`; there is no mapping code in PHP.

**Freshness** is `FreshnessService` — one definition of the three tiers, which
every badge, bar, dial and ranking reads from.

**Ranking** is arithmetic, not learned, so it can be checked on the spot:

```
priority = 0.6 × match%  +  0.4 × urgency  +  local bonus
```

**Dish pictures** are generated per recipe by `App\Support\DishArtwork` — flat
SVG illustrations derived deterministically from the title. No stock
photography, no image model, nothing that needs a network.

**No sensors, deliberately.** The camera is the sensor, and shelf life is domain
knowledge rather than a live measurement. Gas sensors are expensive, unreliable
at consumer scale, and — per the rulebook, where device problems are not taken
into account — a live-demo risk a pure software pipeline does not carry.

---

## Offline

The venue provides no internet, so model weights live in `vision/weights`
(~370 MB, fetched once by `scripts/warm-cache.ps1`), fonts are bundled, recipes
are seeded locally and the database is a file.

Rehearse it properly — turn WiFi **off**, then:

```powershell
.\scripts\offline-check.ps1
```

It walks the whole judge-visible loop and reports anything that quietly wanted a
network.

---

## Tests

```bash
php artisan test           # 44 tests
cd client && npm run lint
```

`FridgeLoopTest` covers session isolation, the tier thresholds, the health
dial's arithmetic, the fast-forward clock and its "only what just turned red"
alert rule, and both halves of the waste counter. `SuggestionEngineTest` covers
detector-label mapping, urgency-weighted ranking, the local-cuisine bonus and
"what am I missing?".

---

## Scripts

| Script | What it does |
| --- | --- |
| `setup.ps1` | One-time: dependencies, database, model weights |
| `start-demo.ps1` | Starts all three processes, waits for each, opens the browser |
| `stop-demo.ps1` | Frees ports 5173 / 8000 / 8001 |
| `warm-cache.ps1` | Pulls every model file while you still have WiFi |
| `offline-check.ps1` | The rehearsal — run it with the network off |

---

## Demo photos

Drop 3–4 fridge photos into `client/src/assets/demo-photos/` and they appear as
thumbnails in the scan panel — no manifest to update. See the README in that
folder for what makes a good one. A webcam under hall lighting is a coin flip;
saved photos are the primary path and the camera is the flourish.

---

## Further reading

**[context.md](context.md)** — the engineering record: how the pieces fit, the
decisions behind them, and what is real versus simulated.

**[docs/EXHIBITION.md](docs/EXHIBITION.md)** — the exhibition pack: feature
checklist against the proposal, the 90-second script, the 500-word report, the
SDG and CEP mapping, and what is left to do before Tuesday.
