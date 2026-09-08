# context.md

Working notes for **Leftover Chef** — what it is, how the pieces fit, and why
they are the way they are. Read this before changing anything structural, and
update it when you do.

**Last updated:** 8 September 2026

The exhibition-day material — script, report, SDG/CEP mapping — lives in
[docs/EXHIBITION.md](docs/EXHIBITION.md).

---

## 1. What this is

Photograph the inside of your fridge. A vision model names what is in it, the
app tracks how long each thing has left, warns you when something is about to
go, and tells you what to cook with it — then counts what you actually saved.

Built to the project proposal for the **AUST CSE Carnival 8.0 Software & AI
segment** (9 September 2026). The proposal is the scope: if a feature is not in
it, it is not here, and a lot that used to be has been removed.

**Team:** Easteak Ahmed (lead) · Saleh Mahmud Sami (front-end) ·
Fairuz Anadi (back-end).

---

## 2. The loop, and why it is the point

```
   detect  ──▶  track  ──▶  warn  ──▶  cook  ──▶  measure
```

Most student projects build one link. The argument this project makes is that
the links *are* the product: detection without tracking is a party trick,
tracking without suggestion is a chore nobody keeps up, and suggestion without
measurement is a claim nobody can check.

Every feature exists to close that loop. Anything that did not was taken out.

---

## 3. The two constraints that shaped everything

**No internet at the venue.** Rulebook §07. That rules out every cloud vision
API and drives the architecture: the detector is a process on this laptop,
weights are cached in the repo, fonts are bundled, recipes are seeded locally
and the database is a file. Pull the network cable and nothing changes.

**No accounts.** The proposal says single-session, local state only. So there is
no login, no profile and no user behind the fridge: the browser generates a
session id, keeps it in localStorage, and sends it as `X-Fridge-Session`.
`ResolveFridgeSession` turns that into a `FridgeSession` on every request. A
judge picks up the laptop and is already using the app.

That id is not a credential. It identifies a shelf, not a person, and there is
nothing behind it worth protecting — which is why an unrecognisable one is
quietly replaced with a fresh one rather than rejected.

---

## 4. Shape of the system

```
   React 19 + Tailwind 4        Laravel 10 API          FastAPI + YOLO-World
   localhost:5173      ─────▶   localhost:8000  ─────▶  localhost:8001
   one screen                   tracking, ranking       detection only
                                      │
                                      └── SQLite
```

The browser never talks to the sidecar. Laravel proxies, so there is one origin
and the sidecar stays a stateless "image in, boxes out" service with no database
and no idea what an ingredient is. Swapping the model means restarting one
process — which matters, because a teammate is fine-tuning one.

### The API, in full

| Method | Path | What |
| --- | --- | --- |
| `GET` | `/api/fridge` | The entire screen: shelf, tiers, health, waste, leaderboard, suggestions |
| `POST` | `/api/fridge/items` | Add one by hand |
| `PATCH` | `/api/fridge/items/{item}` | Correct a use-by date |
| `DELETE` | `/api/fridge/items/{item}` | Remove — `?binned=1` counts it as waste |
| `POST` | `/api/fridge/fast-forward` | Move the demo clock, return new 🔴 alerts |
| `POST` | `/api/fridge/reset` | Put the demo back between judges |
| `GET` | `/api/fridge/scan/status` | Is the detector up |
| `POST` | `/api/fridge/scan` | Photo → candidate ingredients + boxes |
| `POST` | `/api/fridge/scan/confirm` | Commit the confirmed chips |
| `GET` | `/api/recipes/{recipe}` | The Recipe Reveal: art, method, what it consumes |
| `POST` | `/api/recipes/{recipe}/cooked` | Take the ingredients out, log the rescues |
| `POST` | `/api/fridge/restore` | Undo the above |
| `GET` | `/api/recipe-images/{path}` | Generated dish artwork |
| `GET` | `/api/ingredients` | Vocabulary, for manual correction |

`GET /api/fridge` returns everything because it is one screen. Six round trips
to draw it would be six chances to render half of it.

---

## 5. The detector

**YOLO-World, open vocabulary, zero-shot.** It takes a list of text prompts
instead of a fixed class list, so `vision/vocabulary.json` asks it for
`"carton of milk"` and `"tin of tomatoes"` — 49 fridge classes, no labelled
dataset, and adding an ingredient is one line of JSON. Measured at roughly
**200–300 ms per photo on CPU**.

COCO-pretrained YOLOv8n is the automatic fallback (`LC_BACKEND=coco`); it knows
five foods out of eighty, which is why it is the fallback.

> **A teammate is fine-tuning a model separately. Nothing in `vision/` should
> change without talking to them.** `Detector` is written as an ordered backend
> list precisely so a fine-tuned checkpoint drops in ahead of the others without
> touching anything else in the stack.

**Detector labels become ingredient rows through the alias table and nothing
else.** `vocabulary.json` says `"tin of tomatoes" → "Chopped Tomatoes"`;
`IngredientSeeder` lists that phrasing among the row's aliases;
`Ingredient::lookup()` resolves it. There is no mapping code in PHP and there
should never be — adding a detector class means adding an alias.

**The confirm step is not optional.** Detections become removable chips and
nothing reaches the fridge until the cook presses the button. It turns an
imperfect model into a reliable product, and separately it is just correct — the
person is standing in front of their own fridge and knows what is in it.

---

## 6. Freshness, and the one definition of it

`FreshnessService` owns the three tiers and everything derived from them:

| Tier | Days left | Meaning |
| --- | --- | --- |
| 🟢 `fresh` | 4 or more | fine |
| 🟡 `soon` | 1–3 | use it this week |
| 🔴 `today` | 0 or less | today, or already over |

Badges, countdown bars, the health ring, the notification and the recipe
ranking all read from here, so "at risk" means one thing in the app rather than
four that drift apart.

**Dates come from a lookup table, not the model.** `ShelfLifeCatalog` holds
typical refrigerated shelf life per ingredient with an aisle fallback — spinach
3 days, chicken 2, garlic 60. Fifty of the ninety-two ingredients have one;
salt, rice, oil and every spice have `null`, because a countdown on the salt is
noise, and noise dilutes the shelf that is supposed to mean "cook this tonight".

A guessed date is labelled as one, and stops being a guess the moment anybody
edits it.

**Every date comparison goes through `$session->today()`, never
`Carbon::today()`.** That indirection is the entire reason the fast-forward
button moves the whole screen at once instead of half of it. If you add anything
that reads the clock, read it from the session.

---

## 7. What is real and what is simulated

The proposal commits to disclosing this, so it is written down here too.

**Real, running live:** detection on the actual photo; shelf-life tracking and
tier calculation; recipe matching and ranking; the health dashboard; the waste
counter; the dish artwork. All local, all offline.

**Simulated, and openly so:**

- **The notification.** A real OS push would mean waiting until tomorrow.
  Instead the fast-forward button advances the session clock, and anything that
  *crosses into* 🔴 raises the alert immediately. Something already red
  yesterday is not news and does not fire again.
- **The starting fridge.** A new session is stocked by `DemoFridge` with a
  realistic mixed state — something overdue, something due today, a few things a
  week out, and undated staples. A freshness dashboard on an empty shelf teaches
  nobody anything, and there is no time to wait for real days to pass.
- **The rival households** on the leaderboard are fabricated, and labelled
  "sample households" on screen. They exist because a number needs a scale to be
  read against.

**Not built, and not claimed:** barcode or receipt logging, and any physical
sensor.

### Why no sensors

The camera is the sensor. Shelf life is domain knowledge, not a live
measurement — knowing milk lasts about four days comes from a table, not from
sniffing it. Real spoilage sensors are expensive, unreliable at consumer scale,
and per the rulebook device problems during the exhibition are not taken into
account. A pure software pipeline is the lower-risk demo *and* the stronger
engineering story.

---

## 8. The waste counter

`WasteLedger` writes one row per ingredient that reached a decision point:
`rescued` when it was used while still good, `lost` when it was binned.

The lost half matters. A counter that only goes up is a decoration rather than a
measurement — so the UI shows binned alongside saved, and the save rate between
them. Undo withdraws the rescues it granted, for the same reason.

---

## 9. Where things live

```
context.md                     this file
README.md                      how to run it

scripts/
  setup.ps1                    one-time: deps, database, weights
  start-demo.ps1               three processes, waits for each
  stop-demo.ps1                frees the three ports
  warm-cache.ps1               pull the model files while on WiFi
  offline-check.ps1            the rehearsal — run it with WiFi OFF

vision/                        the sidecar — a teammate owns the model
  app.py                       FastAPI: GET /health, POST /detect
  detector.py                  backend selection, inference, dedupe
  vocabulary.json              49 prompts → canonical ingredient names
  weights/                     gitignored, ~370 MB

app/Http/Services/
  FreshnessService.php         tiers, urgency, the health dial
  RecipeSuggestionService.php  ranking, local bias, "what am I missing?"
  PantryConsumptionService.php what a recipe eats, and putting it back
  WasteLedger.php              the counter and the leaderboard
  DemoFridge.php               the fridge a new visitor opens on
  VisionClient.php             HTTP to the sidecar, degrades to a clear 503
  DetectionMapper.php          detections → ingredient rows

app/Support/
  ShelfLifeCatalog.php         how long each ingredient keeps
  DishArtwork.php              generated plated-dish SVGs
  CuisineCatalog.php           country/region, which the local bias reads

client/src/
  App.jsx                      the whole screen
  freshness.js                 the tier colours, shared
  components/ScanPanel.jsx     photo → boxes → chips → confirm
  components/Shelf.jsx         the fridge, worst first
  components/HealthDial.jsx    the ring
  components/WastePanel.jsx    counter + leaderboard
  components/RecipeReveal.jsx  fridge photo beside the plated dish
  components/VoiceAsk.jsx      "what can I make for dinner?"
```

---

## 10. What was removed, and why

The app was built on the FridgeToFork codebase, which carried a great deal the
proposal does not ask for. All of it is gone: accounts and login, the admin
dashboard, user profiles, reviews, tips and points, the meal planner, the
shopping list, the cuisine map, recipe authoring and browsing, the contact page,
and nutrition analysis. Eighty-three files, and the API went from 57 endpoints
to 14.

Two things survive as **seed metadata only**, reachable from no route and no
screen: the `users` table records who wrote each seeded recipe, and `categories`
feeds `DishArtwork`'s palette choice. Rewriting the 32-recipe dataset to strip
them would have been a large edit to the one asset the demo cannot afford to
break, for no visible gain. If that bothers a reader, it is the right next
cleanup — not an oversight.

---

## 11. State of things

**Done and verified**

- The whole loop, end to end in a browser: photo → 6 ingredients in ~280 ms →
  confirmed → dated → fast-forward → notification → reveal → cooked → counter
  moved.
- 42 PHPUnit tests pass. `npm run build` and eslint clean.
- `offline-check.ps1` passes 10/10 against the running stack.

**Not done**

- **Real fridge photos.** The bundled sample is a food-styling shot: it detects
  six things but they do not combine into much. Take 3–4 real ones — still the
  highest-value hour left.
- **The offline rehearsal has not been run with WiFi actually off**, on the
  laptop that is going to the venue.
- **The 500-word project report** (rulebook §06) must reach the organisers
  before the presentation slot. Failing to submit it is a disqualification
  ground.

---

## 12. The 90-second demo

1. **Open.** *"We built a fridge that thinks for you — point your phone, and it
   tells you what to eat before it's too late."*
2. **Scan** a saved shelf, or hand the judge the laptop and let them photograph
   whatever is on the table. Boxes land on their own picture, in about a fifth
   of a second, on this machine.
3. **Confirm** the chips — drop a wrong one, add a missed one. *"The model
   proposes, the cook decides."*
4. **Reveal**: fridge photo beside the plated dish. *"Instead of telling you what
   to buy, we tell you what to cook with what you already have."*
5. **Fast-forward a day.** Every bar moves, something turns red, the alert
   fires, the suggestions reorder around it.
6. **Cook it.** The counter moves. *"Every ingredient used before this point is
   food that didn't go in the bin."*
7. **Close.** *"No sensors, no internet — just a camera and a model, running
   entirely on this laptop."* Then offer to turn the WiFi off and do it again.
