# FridgeMama

### A smart fridge companion — detect, track, and cook before it spoils

*"We built a fridge that thinks for you — point your phone, and it tells you what
to eat before it's too late."*

Photograph the inside of your fridge. A vision model names what is in it, the
app tracks how long each thing has left, warns you when something is about to
go, and tells you what to cook with it. Everything runs on the laptop — no
cloud, no accounts, no internet.

Built to a written project proposal, which is the scope: if a feature is not
in it, it is not here.

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

```bash
# On macOS / Linux:
./scripts/start-demo.sh   # three processes, one command (stops with ./scripts/stop-demo.sh)

# On Windows:
.\scripts\setup.ps1        # once, with internet — deps, database, model weights
.\scripts\start-demo.ps1   # every time after — three processes, one command
```

Opens <http://localhost:5173>. **There is no login** — the fridge belongs to the
browser session, and a new visitor opens on a stocked demo fridge.

### By hand

```bash
# 1. Start PostgreSQL with Docker
docker compose up -d

# 2. Setup backend
composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan serve                              # :8000

# 3. Setup frontend
cd client && npm install && npm run dev        # :5173

# 4. Setup vision sidecar
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

## Install it on a phone

FridgeMama is a progressive web app: the same code, but with a manifest, an
icon set and a service worker, so a phone can put it on its home screen and
open it full-screen with no address bar and no tabs. That is not decoration —
a fridge app that takes four taps and a typed URL to reach is a fridge app
nobody opens.

`start-demo.ps1` builds the client and serves the build, because a service
worker is only registered in production. It prints two addresses:

```
Open          : http://localhost:5173
On your phone : http://192.168.0.203:5173
```

The second one is the laptop's address on the local network. On the phone:

1. Join the same WiFi as the laptop, or the laptop's hotspot.
2. Open that address in **Chrome** (Android) or **Safari** (iPhone).
3. **Android** — tap **Install** in the page header, or Chrome's ⋮ menu →
   *Add to Home screen*.
   **iPhone** — tap **Share** → *Add to Home Screen*. Safari has no install
   API, so the button on the page tells you where Apple put theirs.

It opens at `/app`, straight into the fridge — someone who has already
installed it does not need the pitch again.

**What still needs the laptop.** The detector, the recipes and the fridge all
live on the laptop; the phone is a screen and a camera. The service worker
caches the app shell, so the installed app opens instantly and opens *at all*
when the laptop is asleep — but it will tell you it cannot reach the kitchen
rather than showing you a stale fridge. Live state is never served from cache.

**Camera.** On the laptop, "Use the camera" opens a viewfinder in the page. On
a phone reached over plain `http://`, browsers do not expose `getUserMedia` at
any price, so the button hands off to the phone's own camera app instead — same
photo, same scan, and it gets the autofocus and the flash for free.

---

## The APK

The web app installs from a browser and needs no toolchain. The APK exists for
the other case: handing somebody a file, or wanting the app in the app drawer
rather than on a home screen.

```powershell
.\scripts\setup-android.ps1     # once: JDK, Android SDK, Gradle (~1 GB)
.\scriptsuild-apk.ps1         # about a minute after that
```

Out comes `FridgeMama.apk` in the repo root. Copy it to a phone, open it,
allow the install, done — Android will warn about installing from an unknown
source, which is what sideloading looks like and is expected.

**The APK carries the screens, not the fridge.** The detector, the recipes and
the shelf are all still on the laptop, so the app has to be told where the
laptop is. That address is baked in at build time from the machine you built
on, and the app's first screen lets you change it — because the address is
whatever the hotspot handed out that morning.

```powershell
.\scriptsuild-apk.ps1 -Kitchen 192.168.43.1
```

Three things this needed that the web app did not:

| | |
| --- | --- |
| **A configurable API base** | In a browser `/api` is same-origin. In the APK the screens are served out of the package, so a relative path resolves to a file that is not there. `src/api.js` decides between them at runtime off `window.Capacitor`. |
| **Cleartext HTTP** | Android has refused plain `http://` since API 28, and the laptop has no certificate and no domain name. `network_security_config.xml` permits it, with the reasoning written in the file. |
| **The phone's camera app** | The APK's origin is `http://localhost`, which counts as secure, so `getUserMedia` exists and would be tried — then fail, because the WebView has no camera permission behind it. It hands off to the camera app instead, which needs no permission and takes the better photo. |

---

## The front page, and the workspace

`/` is the landing page: the hero, the four steps, the three decisions worth
defending, and the install instructions. It is what sits on the laptop between
judges and the first thing anyone sees on their own phone.

`/app` is the workspace. The sidebar is a set of **lenses, not places** —
**Kitchen** holds the entire loop on one screen (scan, shelf, recipes, health,
waste, voice, missing links), because a ninety-second demo cannot afford a
click that only moves you somewhere else. **My Fridge**, **Recipe ideas** and
**Impact** are that same data given room. Every block is built once in
`App.jsx` and placed into whichever views need it, so nothing is reachable from
only one place.

Routing between the two is `pushState` and a `popstate` listener in
`src/Root.jsx`, not a router library: two screens, and no third one coming.

### Design

Navy ink on cream, teal for the brand, lime as the second voice. Every colour
is a token in `src/index.css` — re-pointing those tokens re-skins the whole app
without touching a component, which is exactly how the redesign happened.

Two rules the palette will not bend on: the three freshness tiers are the only
colours that carry meaning, and they are tuned for contrast at a metre rather
than for a design file. Fonts (DM Sans, Manrope, Noto Sans Bengali, IBM Plex
Mono) are all bundled — a webfont fetched from Google is a network request the
venue cannot make, and `offline-check.ps1` fails the build if one appears.

---


## The online preview

The app is deployed to Vercel as a **preview build**, so a link is something
somebody can click rather than only read.

```powershell
vercel login      # once
vercel --prod     # from the repo root
```

`vercel.json` builds only `client/` with `VITE_PREVIEW=true`. Nothing else in
the repo is uploaded — see `.vercelignore`.

**What the preview is.** Laravel, SQLite and 370 MB of YOLO weights do not go
on a static host, and the project's argument is that they do not need to: it
runs on the laptop, offline. So `src/preview/backend.js` answers every request
in the browser instead. The data is *dumped, not authored* — `fixture.json`
comes out of the real database (132 ingredients with their Bangla names and
shelf lives, 40 recipes with their real method steps, the demo fridge, and the
composer's own templates exported from the PHP constants so the two cannot
drift). The behaviour is *ported, not approximated*: the freshness tiers, the
urgency curve, the health dial, the ranking formula with its qualification
gate, and the recipe composer are the same rules written again in JavaScript.
It ranks the demo fridge identically to the server.

**What it cannot do is run the model.** `POST /fridge/scan` replays a recording
of the detector's real output on the bundled photo — six ingredients, boxes and
confidences included, 428 ms as measured. A banner says so on every screen.

The preview is a way to share the project. It is not the demo: the demo is the
laptop, with the WiFi off.

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
php artisan test           # 51 tests
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
| `start-demo.ps1` | Builds the client, starts all three processes, prints the phone URL |
| `start-demo.ps1 -Dev` | Same, but the Vite dev server with hot reload (not installable) |
| `stop-demo.ps1` | Frees ports 5173 / 8000 / 8001 |
| `warm-cache.ps1` | Pulls every model file while you still have WiFi |
| `offline-check.ps1` | The rehearsal — run it with the network off |
| `setup-android.ps1` | One-time: JDK, Android SDK and Gradle, outside the repo |
| `build-apk.ps1` | Builds `FridgeMama.apk` with the laptop's address baked in |

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
