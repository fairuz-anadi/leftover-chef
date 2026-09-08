# Exhibition pack

Everything that is not code: what to say, what to submit, and what is left to
do. [`context.md`](../context.md) is the engineering record;
[`README.md`](../README.md) is how to run it.

**AUST CSE Carnival 8.0 — Software & AI** · 9 September 2026
Easteak Ahmed (lead) · Saleh Mahmud Sami (front-end) · Fairuz Anadi (back-end)

---

## 1. Feature checklist, against the proposal

Every core feature is built and running.

| # | Core feature | Status | Where it shows |
| --- | --- | --- | --- |
| 1 | Fridge photo scan | ✅ | Scan panel — upload, camera, or a saved shelf |
| 2 | Auto shelf-life estimation | ✅ | `ShelfLifeCatalog`; dates appear without typing |
| 3 | Tiered freshness 🟢🟡🔴 | ✅ | Badge + countdown bar on every item |
| 4 | Recipe suggestions, 🔴/🟡 first | ✅ | "Cook this", ranked by match + urgency |
| 5 | Fridge health dashboard | ✅ | Stacked ring, fresh / soon / today |
| 6 | Notification simulation | ✅ | *Fast-forward a day* → red alert banner |
| 7 | Food-waste-saved counter | ✅ | Saved / binned / save rate |

| # | Stretch feature | Status | Notes |
| --- | --- | --- | --- |
| 8 | Local-cuisine bias | ✅ | Bangladesh +8, South Asia +4 priority points; "local" tag on the card |
| 9 | "What am I missing?" | ✅ | Ranks the one ingredient that unlocks the most recipes |
| 10 | Manual correction | ✅ | Drop a chip before confirming; add by name; edit any date |

| Wow factor | Status | Notes |
| --- | --- | --- |
| Recipe Reveal | ✅ | Your fridge photo beside the generated plated dish |
| Judge Challenge Mode | ✅ | No special mode needed — hand them the laptop and scan the table |
| Voice assistant | ✅ | Speech in where the browser supports it, spoken answer always |
| Freshness Race countdown | ✅ | Bars animate together on fast-forward; new reds pulse |
| Waste-saved leaderboard | ✅ | Five sample households, labelled as samples |
| Elevator hook | ✅ | Printed under the logo, so it is said the same way every time |
| The Fridge Frame prop | ⬜ | **Physical — someone needs to make it.** Cardboard cutout to photograph through |

---

## 2. The 90-second script

Have it **running before they arrive** — the rulebook gives no extra time.
One person drives, one narrates, one watches the laptop.

| Time | Beat | Say |
| --- | --- | --- |
| 0:00 | The screen is already showing a fridge with two red items | *"We built a fridge that thinks for you — point your phone, and it tells you what to eat before it's too late."* |
| 0:15 | **Scan** a saved shelf. Boxes land on the photo | *"One photo. That's the whole input — and that ran here, on this laptop, in about a fifth of a second."* |
| 0:30 | **Drop a wrong chip, add a missed one**, confirm | *"The model proposes. The cook decides."* |
| 0:45 | **Open a suggestion** — fridge photo beside the plated dish | *"Instead of telling you what to buy, we tell you what to cook with what you already have."* |
| 1:05 | **Fast-forward a day.** Bars move, something turns red, the alert fires | *"That's four days of tracking in one press. Your chicken just went red — and the recipes re-ranked around it."* |
| 1:25 | **Cook it.** The counter moves | *"Every ingredient used before this point is food that didn't go in the bin."* |
| 1:40 | **Close** | *"No sensors, no internet — just a camera and a model running entirely on this laptop."* |
| — | If they linger | *"Want to photograph something on the table yourself? Or shall I turn the WiFi off and do it again?"* |

**Rules:** never apologise for a wrong detection — drop it and say *"that's what
the confirm step is for."* Never say "it should…". If something breaks, move to
the next beat; do not debug on stage. Press **Reset demo** between judges.

---

## 3. The 500-word report

Rulebook §06: 500 words, on the emailed template, delivered **before your
presentation slot**. §10 lists failure to submit as a disqualification ground.

### Draft (494 words, title included)

> **Leftover Chef — A Smart Fridge Companion**
>
> **Problem.** Roughly a third of the food produced for human consumption is
> never eaten, and much of that loss is domestic. Two everyday failures cause
> it, and they are really one problem. People stand in front of a fridge unable
> to decide what to cook from it, and food expires unnoticed at the back of
> that same fridge. Both come from a lack of
> visibility: no household reliably knows what it owns or how urgently each item
> needs using. Existing expiry-tracking applications ask the user to type in
> every item and every date, which is why people abandon them within a week.
>
> **Solution.** Leftover Chef removes the data entry. The user photographs the
> inside of their fridge; a computer-vision model identifies the ingredients and
> returns them as labelled regions drawn over the photograph. The user confirms
> or corrects that list, and each accepted item receives an expiry countdown
> derived from its food type. Items are then displayed in three tiers — fresh,
> use soon, use today — and a recipe engine ranks dishes by how much of each can
> be prepared from present ingredients, weighted by how urgently those
> ingredients need using. A dashboard reports overall fridge health, and a
> counter records every ingredient consumed before it spoiled. Nothing enters
> the inventory unapproved, so an imperfect model never alters the record
> silently.
>
> **Technical approach.** Three local processes: a React interface, a Laravel
> API, and a Python inference service. Detection uses YOLO-World, an
> open-vocabulary detector accepting natural-language class prompts rather than
> a fixed trained class list, giving forty-nine fridge-specific categories
> without a labelled dataset. Shelf life is a lookup table of food-science
> averages rather than a sensor reading. Ranking is deliberately arithmetic and
> explainable: sixty percent ingredient match, forty percent urgency, plus a
> weighting toward Bangladeshi cuisine.
>
> **Simulated components.** Two elements are simulated and are declared as such.
> Rather than waiting days for a scheduled notification, a control advances the
> application's internal clock, immediately triggering alerts for items crossing
> into the critical tier. A new session also begins with a pre-populated fridge
> so that freshness states are visible without elapsed time.
>
> **Constraints.** The venue provides no internet connection. All inference
> therefore runs on the presenting laptop: model weights are cached locally,
> typography is bundled, recipes are stored locally, and the database is
> file-based. Detection completes in approximately two hundred milliseconds on
> CPU hardware with no GPU. No physical sensors are used; the camera performs
> that role, avoiding the hardware failure modes that a live exhibition cannot
> accommodate.
>
> **Impact.** The project addresses Sustainable Development Goal 12, Responsible
> Consumption and Production, specifically Target 12.3 on halving per-capita
> food waste. The waste-reduction mechanism is the ranking function itself
> rather than an additional feature, and the counter reports the result as a
> measured quantity rather than a claim. The same counter records food that was
> discarded, so the figure presented is a rate between the two rather than a
> total that can only increase.

**If you fine-tune before submission,** replace the YOLO-World sentence with the
measured numbers — *"a fine-tuned YOLOv8n trained on N annotated fridge images
achieves mAP50 of X"* — and say it runs ahead of the open-vocabulary model.
Numbers beat adjectives.

---

## 4. SDG and CEP

Most teams assert these in a line. Doing it properly is free marks.

**SDG 12 — Responsible Consumption and Production (primary).** Target 12.3,
halving per-capita food waste at consumer level: the expiry-weighted ranking is
the intervention, and the counter measures it. Target 12.8, information for
sustainable lifestyles: the app always shows *why* a dish is recommended, so it
teaches the habit rather than just serving an answer. Secondary: **SDG 2** —
making existing food go further has the same effect as buying more; **SDG 13** —
food waste is roughly 8–10% of global greenhouse emissions.

| CEP attribute | How it applies |
| --- | --- |
| **WP1 · Depth of knowledge** | Open-vocabulary object detection, vision-language embeddings, multi-criteria ranking design, multi-process architecture, relational modelling |
| **WP2 · Conflicting requirements** | Detector accuracy vs extensibility; automation vs user control; offline operation vs model size; cookability vs urgency in one ranking |
| **WP3 · Depth of analysis** | No standard answer: the urgency curve, the diminishing-returns aggregation and the weighting between two incommensurable quantities were all derived, then constrained to stay explainable |
| **WP4 · Familiarity of issues** | Beyond coursework: zero-shot detection, weight provisioning for an air-gapped machine, graceful degradation of an ML component |
| **WP5 · Applicable codes** | No standard covers "rank recipes by waste avoided" — the team defined the metric, its bounds and its test criteria |
| **WP6 · Stakeholders** | Home cooks want speed, the environment wants waste reduction, the exhibition demands reliability with no internet. The confirm step and the offline architecture are the reconciliations |
| **WP7 · Interdependence** | Three interdependent subsystems; a change to the detector vocabulary propagates through the alias table into ranking and the UI, which is exactly why the vocabulary is data rather than code |

---

## 5. Questions judges ask

**"Did you train the model?"**
> A teammate is fine-tuning one now. What is running today is YOLO-World, which
> takes text prompts instead of a fixed class list — so our vocabulary is a JSON
> file of 49 fridge items and adding one is a line. The detector is written as an
> ordered backend list so the fine-tuned model drops in ahead of it.

**"What's your accuracy?"**
> One or two corrections per photo, typically. But we designed on the assumption
> the model is sometimes wrong, which is why nothing is logged until you confirm.
> An accuracy figure would be reassuring and slightly dishonest; the confirm step
> is what actually makes it reliable.

**"Where do the expiry dates come from — can it see freshness?"**
> No, and claiming otherwise would be a stretch. They come from a shelf-life
> table: spinach three days, chicken two, garlic sixty. It is a starting guess,
> marked as one on screen, and one tap corrects it. Detecting actual spoilage is
> the interesting next problem.

**"Isn't the notification fake?"**
> It is simulated, and we say so in the report. A real push means waiting until
> tomorrow. The button advances the app's clock and everything downstream
> recalculates for real — the tiers, the bars, the ranking. Only the trigger is
> shortcut.

**"Why no sensors?"**
> The camera is the sensor, and shelf life is domain knowledge rather than a
> measurement. Gas sensors are expensive, unreliable at consumer scale, and the
> rulebook says device problems aren't taken into account. A software pipeline is
> the lower-risk demo and, we'd argue, the stronger engineering answer.

**"What happens with no internet?"**
> Nothing happens. Shall I show you?

---

## 6. Before Tuesday

| # | Task | Why | Time |
| --- | --- | --- | --- |
| 1 | **3–4 real fridge photos** into `client/src/assets/demo-photos/` | The bundled sample is a food-styling shot; it detects six things that don't combine into much. Highest-value hour left. | 1 h |
| 2 | **Submit the 500-word report** | Rulebook §10 — missing it is disqualification | 1 h |
| 3 | **Run `offline-check.ps1` with WiFi actually off**, on the venue laptop | "Should work offline" and "we watched it work offline" are different claims | 30 min |
| 4 | **Rehearse the 90 seconds twice** | Time is strictly maintained; it must be running before judges arrive | 1 h |
| 5 | **Build the Fridge Frame prop** | The one wow-factor item that is not code | 1 h |
| 6 | **Pack the multi-plug** | Mandatory per rulebook §07 | — |

**Also worth doing:** print the ranking formula (`0.6 × match + 0.4 × urgency`)
on a card for the desk — judges photograph things like that; and put a 40-second
screen recording on a phone at the desk for when the queue backs up.

---

## 7. Numbers worth memorising

| | |
| --- | --- |
| Detector classes | **49**, zero-shot, one line of JSON to add one |
| Detection time | **~200–300 ms** per photo, **CPU only** |
| Recipes | **40**, across 23 countries — **10 Bangladeshi** |
| Ingredient vocabulary | **97**, all named in Bengali, **52** with a shelf life |
| Freshness tiers | **3** · horizon **7 days** |
| Ranking | **0.6** match · **0.4** urgency · **+8** Bangladeshi |
| API surface | **14 endpoints** (was 57 before the scope cut) |
| Tests | **44 passing** |
| Processes to start | **3**, via **1** command |
| Model cache | **~370 MB**, entirely local |
