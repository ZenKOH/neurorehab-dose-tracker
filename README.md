# NeuroRehab Dose Tracker

A tiny browser-based app for tracking neurorehabilitation therapy dose, quality, fatigue, repetitions, and carryover.

It runs fully offline on a MacBook. No backend, no API key, no account, and no installation required.

## What it does

- Add therapy sessions with minutes, repetitions, movement quality, fatigue, and carryover.
- Set weekly dose targets.
- See weekly progress for therapy minutes and repetitions.
- Get simple AI-style rule-based review prompts.
- Store data locally in your browser using `localStorage`.
- Export all session data as CSV.

## Run immediately on Mac

### Option 1: Open directly

1. Download or clone this repository.
2. Open `index.html` in Safari, Chrome, Arc, or Edge.
3. Start logging sessions.

### Option 2: Run as a local web server

Open Terminal in this folder and run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Put it on GitHub

```bash
git init
git add .
git commit -m "Initial NeuroRehab Dose Tracker"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/neurorehab-dose-tracker.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.

## Optional: Publish with GitHub Pages

1. Go to your GitHub repository.
2. Open **Settings**.
3. Open **Pages**.
4. Set source to **Deploy from a branch**.
5. Select branch **main** and folder **/root**.
6. Save.

GitHub will give you a public URL for the app.

## Privacy

All data is stored locally in the browser on your own machine. Nothing is uploaded anywhere unless you manually export or publish your files.

## Medical disclaimer

This tool is for tracking, education, and workflow exploration only. It is not medical advice and does not replace a licensed clinician.
