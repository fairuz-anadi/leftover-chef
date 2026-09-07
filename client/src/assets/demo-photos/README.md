# Demo photos

Drop 3–4 fridge photos in here as `.jpg`, `.jpeg`, `.png` or `.webp`. They show
up as a strip of thumbnails under **Snap your fridge**, and clicking one runs a
scan on it.

No manifest to update — `FridgeScan.jsx` globs this folder at build time, so a
file dropped in is a sample, and a file deleted is gone. Vite bundles them into
the build, so they still work with the network off.

## What makes a good one

The webcam under exhibition-hall lighting is a coin flip. These photos are the
primary demo path and the webcam is the flourish if the room turns out to be
bright, so it is worth taking them properly:

- **Open door, light on, phone straight on.** Angled shelf shots lose depth.
- **6–10 recognisable things**, spread out, not stacked behind each other.
- **Include something in the vocabulary and something not** — the "seen but
  not in the ingredient list" line is a good answer to "what happens when it
  gets it wrong", and it is better to show it deliberately than discover it.
- **At least one item that is genuinely near its date.** The Use It Up shelf is
  the differentiator; give it something real to say.
- Roughly 1–3 MB each. The endpoint caps uploads at 12 MB.

Name them in the order you want them shown — a leading number is stripped from
the label, so `1-full-fridge.jpg` reads as "Full Fridge".

## Checking one before demo day

```bash
php artisan serve
```

then, with the sidecar up:

```bash
pwsh scripts/offline-check.ps1
```

It scans the first photo in this folder and prints how many ingredients came
back. Anything under four or five, retake it.

Files here are gitignored — they are yours, they are large, and every team
member will want their own.
