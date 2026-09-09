# context.md

Working notes for **FridgeMama** — what it is, how the pieces fit, and why
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

Built to the written project proposal. The proposal is the scope: if a feature
is not in it, it is not here, and a lot that used to be has been removed.

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

### Bengali names

Every ingredient carries `name_bn`, shown under or beside the English name
everywhere it appears. `App\Support\BengaliNames` holds the translations keyed
by slug; the migration only adds a nullable column, and an ingredient without a
Bengali name simply shows in English.

**The English name stays the canonical key.** Recipes, the detector vocabulary
and the alias table all resolve through it, so this is a display layer and
nothing downstream has to know it exists. Where a word is a loan word in
everyday Bengali — মাশরুম, পাস্তা, চকলেট — that is what is written, because it
is what people actually say.

Inter carries no Bengali glyphs, so Noto Sans Bengali is bundled and sits after
Inter in the font stack: Latin keeps Inter's metrics and Bengali falls through
to a face that has the letters. Bundled, not fetched, like everything else.

### What "the cupboard stays" means

Cooking a dish removes the perishables it used and leaves the cupboard alone.
That rule is keyed on **shelf life**, not on `ingredients.is_staple`.

The first version used `is_staple`, which was wrong in a way worth remembering:
that flag means "common pantry item" and is set on eggs, onions, tomatoes, milk
and chicken — all things you genuinely eat. Keyed off it, cooking the
top-recommended dish removed *nothing* from a normal fridge and the waste
counter never moved. An ingredient with no meaningful use-by date is the
cupboard; everything else is food.

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
  BengaliNames.php             every ingredient in Bengali, keyed by slug
  DishArtwork.php              generated plated-dish SVGs
  CuisineCatalog.php           country/region, which the local bias reads

client/src/
  App.jsx                      the whole screen
  index.css                    the entire palette, as tokens — retheming is here
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

## 10a. The name, the mark, and the two screens

The project was called Leftover Chef through the rebuild. It is **FridgeMama**
now — every string, cache key, session key and script header moved with it in
one pass, so there is no half-renamed corner to find at the venue.

The mark is a fridge with a heart where the lower door handle would be, drawn
in `components/Logo.jsx` as two-colour SVG rather than imported as a file: it
stays sharp at any size, inherits the page's colours, and costs no request at a
venue with no network. `scripts/` has no icon step — the PNG home-screen icons
are generated from the same geometry and committed under `client/public/icons`.

There are now **two screens**, not one:

- `/` — the landing page. What sits on the laptop between judges, and what a
  phone lands on first. Logo, the four steps, the three decisions worth
  defending, and how to install it.
- `/app` — the app, unchanged. Still one screen, still the whole loop.

`src/Root.jsx` chooses between them with `pushState` and a `popstate` listener.
That is deliberately not a router library: two screens, no third one coming,
and a dependency is a thing that can fail to install at a venue.

The manifest's `start_url` is `/app`, so an installed icon opens the fridge —
somebody who has put this on their home screen does not need the pitch again.

### Installable

`client/public/manifest.webmanifest` and `client/public/sw.js` make this a
progressive web app. The service worker is hand-written rather than generated,
because a build-time PWA plugin means an npm install and this project's whole
argument is that it runs with the WiFi off.

Two strategies, split by what the thing is. The app shell is cache-first —
hashed filenames never change within a build, so serving them from disk is both
correct and instant. `/api/*` is **network-only**: a fridge is live state, and
showing a judge yesterday's shelf is worse than showing them an error.

A service worker only registers in a production build, so `start-demo.ps1` now
builds the client and serves the build. `-Dev` switches back to the dev server
with hot reload, and nothing installs in that mode — by design, since a worker
left over from a build would happily serve a stale bundle over the top of the
one being edited.

Two things this forced:

- **Vite binds to every interface**, not loopback, so a phone can reach it. The
  start script prints the LAN address. Nothing is authenticated, which is fine
  on a hotspot and is the identity model anyway — but it is a reason not to run
  this on a café's WiFi.
- **The camera has two paths.** `getUserMedia` exists only on a secure origin.
  A phone reaching the laptop over plain `http://` has no such thing —
  `navigator.mediaDevices` is simply undefined — so the old code fell into its
  catch and told the user they had no camera while they were holding one.
  `ScanPanel` now falls back to `<input capture="environment">`, which hands
  off to the phone's own camera app and returns the same File. Better than a
  workaround: it gets the autofocus and the flash.

### The APK

The web app installs from a browser and needs no toolchain at all. The APK is
for the other case — handing somebody a file, or wanting the app in the drawer
rather than on a home screen. Capacitor wraps the same `dist/`; there is no
second codebase and no second build of the UI.

`scripts/setup-android.ps1` fetches a JDK, the Android SDK and Gradle into
`../android-toolchain`, outside the repo. `scripts/build-apk.ps1` produces
`FridgeMama.apk`. Android Studio is not involved.

**The APK carries the screens, not the fridge.** That is the honest description
and it is also the interesting one: the detector, the recipes and the shelf all
stay on the laptop, so the phone has to be told where the laptop is. The
address is baked in at build time and editable on the app's first screen,
because it is whatever the hotspot handed out that morning.

Four things this needed, each of which is a real difference between a page and
an app:

- **A configurable API base.** In a browser `/api` is same-origin, which is why
  a phone visiting the printed address needs no configuration. In the APK the
  screens are served out of the package, so a relative path resolves to a file
  that is not there. `src/api.js` decides at runtime off `window.Capacitor` —
  one build, two homes.
- **Cleartext HTTP.** Android has refused plain `http://` since API 28, and the
  laptop has no certificate and no domain name. `network_security_config.xml`
  permits it. It is a blanket `base-config` rather than a scoped one on
  purpose: `<domain>` takes a hostname or a literal IP, not a CIDR range, so
  "the private address ranges" is not something that file can say.
- **Laravel on every interface.** `php artisan serve --host=0.0.0.0`, because
  the app talks to Laravel directly instead of through Vite's proxy. Same
  exposure the client already had. CORS needed nothing — `config/cors.php` was
  already open for `api/*` and `HandleCors` is in the global stack.
- **The phone's camera app.** The APK's origin is `http://localhost`, which
  counts as a secure context, so `getUserMedia` exists and would be tried —
  and then fail, because the WebView has no camera permission behind it. The
  file-chooser path needs no permission and gets the autofocus and the flash.

### The stocking bug the APK found

Worth recording, because it was invisible until something called the API in a
different order.

A new fridge opens on the demo contents. That used to be keyed off
`$session->wasRecentlyCreated`, which is true only on the request that created
the row — so it held exactly as long as `GET /fridge` was the first call any
client ever made. The Android app checks the connection before it saves the
laptop's address, and that check creates the session. Every APK user would have
opened on an empty shelf: no error, no clue, just the one screen that teaches a
judge nothing.

It is a `stocked_at` column now, and the condition is *both* that column being
null *and* the shelf being empty. The column stops a fridge somebody emptied on
purpose refilling itself on the next page load; the emptiness check stops the
demo contents landing on top of a fridge that was filled another way — which is
what six tests started failing about the moment the column alone was used.
Two tests cover it.

---

## 10b. The redesign

A frontend mock arrived as a Manus scaffold — TypeScript, shadcn/ui, wouter,
254 KB of lockfile — with the note that it was "just the inspo". So the design
was taken and the stack was not: nothing in this repo changed language,
framework or router, and no shadcn component was copied. What moved across was
the look.

**The palette is the whole trick.** Every component already read its colours
from tokens rather than literals, so re-pointing about thirty custom properties
in `index.css` re-skinned the entire app in one edit — navy ink on cream,
teal as the brand, lime as the second voice — without touching a single
component's colours. That is the payoff for a rule written months earlier and
kept.

Three things were changed rather than copied:

- **The fonts are bundled.** The mock pulls DM Sans and Manrope off Google
  Fonts, which is a network request the venue cannot make and which
  `offline-check.ps1` fails on by design. They are `@fontsource` packages now.
- **The lime is two colours.** `--lime` is the fill; `--lime-ink` is the same
  green dark enough to read as text. #76d43b on cream is about 1.9:1 — fine
  behind a fridge, unreadable as a word, and the wordmark is a word.
- **The tiers stayed dark.** The mock's coral and yellow are lovely and fail at
  a metre. Green, amber and red are the only colours in this app that carry
  meaning, and they are tuned for a judge standing at a stall, not for a design
  file.

**The mark** is now a fridge with a lime leaf in its corner, drawn as two-tone
SVG in `components/Logo.jsx`. `scratchpad/icons.py` renders the same geometry
into both the web icons and the five Android launcher densities, including the
adaptive foreground scaled into its 72-of-108dp safe zone, so the two sets
cannot drift.

### Two screens became five, and nothing was hidden

The mock has a sidebar workspace: Overview, My Fridge, Recipe ideas, Impact.
Adopting that risks the thing the rebuild was for — the proposal's one screen,
and a ninety-second demo that cannot afford a click which only moves you
somewhere else.

The resolution is that **the sidebar is a set of lenses, not a set of places**.
`Kitchen` holds the entire loop exactly as before: scan, shelf, recipes,
health, waste, the voice question and the missing-ingredient list. The other
three views are that same data given room, for somebody who wants to look
properly rather than be shown. Each block is built once in `App.jsx` and placed
into whichever views need it, so "nothing is only reachable from one place" is
enforced by there being one of each rather than by anyone remembering.

---

## 10c. How a recipe gets on the screen

Two sources, one ranking.

**The library.** Forty seeded dishes, ten Bangladeshi. Each is scored against
your shelf:

    priority = 0.6 x match%  +  0.4 x urgency  +  local bonus

`match%` is how much of the recipe you already hold. `urgency` is how much
at-risk food it would use up, aggregated so the most urgent item counts in
full and each further one adds half the last — three things about to die beat
one, but not by three times, so a recipe cannot win by listing everything.
The bonus is +8 for Bangladesh, +4 for the wider region. Every term is in the
API response, so the arithmetic on the card can be checked by hand.

**The composer.** `RecipeComposer` writes a dish for the shelf in front of it,
from cooking grammar rather than a language model — there is no internet at
the venue. A bhorta is *a soft vegetable, mashed, with raw allium and heat
through it*; a jhol is *a protein and a potato in a thin turmeric gravy*.
Six such templates, each with required slots and optional ones. A template is
skipped unless every required slot can be filled from the fridge, and optional
slots are dropped silently along with the method lines that mention them — so a
composed recipe never lists anything you would have to go and buy. Where two
ingredients could fill a slot, **the one closest to the bin wins**, which
points the generator at the same problem as the rest of the app.

A composed dish is a real row in `recipes`, marked with `generated_at`. That
matters: it is scored by the same engine, opened by the same reveal, and
cooking it takes the same ingredients off the shelf. Nothing downstream knows
the difference, so the card says so out loud instead.

Composed recipes are scoped to the fridge they were written for. They are
ordinary rows, so without that every fridge would see every other fridge's, and
a dish whose entire claim is "written for this shelf" would turn up on somebody
else's.

### The bug this fixed

Photograph six things and Mishti Doi was suggested — needing milk, sugar and
yoghurt, none of which were there. The filter only asked *how many ingredients
are you short*, capped at four. A three-ingredient recipe you own none of is
"three missing", which clears the cap. It then scored zero for match and zero
for urgency, and the local-cuisine bonus — a tie-break — put it on the screen
on its own. Three of five suggestions were under 50% match. From the outside
that is indistinguishable from the list being random, which is exactly what it
was reported as.

A suggestion must now use something you actually own, and at least 40% of it.
The bonus can only reorder recipes that have already earned their place, which
is all a tie-break was ever for. Five tests cover it.

Salt moved to `RecipeIngredientSync::ALWAYS_AVAILABLE` alongside water in the
same pass. No recipe has ever been blocked on salt, and counting it made a
composed dish read as 80% complete when the only thing missing was the salt
cellar.

---

## 11. State of things

**Done and verified**

- The whole loop, end to end in a browser: photo → 6 ingredients in ~280 ms →
  confirmed → dated → fast-forward → notification → reveal → cooked → counter
  moved.
- 51 PHPUnit tests pass. `npm run build` and eslint clean.
- `offline-check.ps1` passes 12/12 against the running stack.
- The service worker registers and activates in real Chrome, with the shell
  cached and the manifest served as `application/manifest+json`. It does *not*
  register in an embedded browser view — that is the view's restriction, not a
  fault in the app, and it cost an hour to establish.

**Not done**

- **Real fridge photos.** The bundled sample is a food-styling shot: it detects
  six things but they do not combine into much. Take 3–4 real ones — still the
  highest-value hour left.
- **The offline rehearsal has not been run with WiFi actually off**, on the
  laptop that is going to the venue.
- **The 500-word project report** (rulebook §06) must reach the organisers
  before the presentation slot. Failing to submit it is a disqualification
  ground.
- **The install prompt has not been seen fire.** Chrome only offers
  `beforeinstallprompt` after a genuine user interaction with the origin, which
  no automated check can produce. Everything it depends on is verified —
  manifest, both icon sizes, a maskable icon, an active worker with a fetch
  handler — and the manual route (Chrome ⋮ → *Add to Home screen*, Safari
  *Share* → *Add to Home Screen*) never needed the event at all. Install it on
  a real phone once before the venue.
- **The team is not named on the landing page.** Add the names when you know
  exactly who should be on it.

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
