# Melbourne Field Guide

A map, illustrated stops, history and local information for walking together in Melbourne’s CBD. The guide includes English and Russian.

Run `npm start` with Node.js 20 or later. The development server listens on port 5173. Change the port with `npm run dev -- --port 3000`. There are no package dependencies.

## Install and use offline

Open the guide once over HTTPS (or localhost during development) and allow it to finish downloading the map, text, photos and fonts. Install through the browser’s install menu, or choose **Share → Add to Home Screen** in iPhone Safari. The guide works in a browser tab as well. Location suggestions require the browser’s location permission.

## Static hosting

Run `npm run prepare:offline` after editing app files or assets. This updates `precache.js`, including the version used for cache updates. The development server generates this file in memory for each request. Serve the app’s static files over HTTPS with `index.html` as the directory index. Ship `sw.js`, `precache.js`, `manifest.webmanifest`, icons, styles, scripts and media together.

## Voice guides

Open a landmark, History, or Local info and tap **Listen to the guide**. Jarrah narrates the English text and Polina narrates the Russian text. When the player shows **Available offline on this device**, that recording can be played again in the same browser or installed app without a download. Each phone and language has its own recordings. If the browser clears its storage, listen once online again.

## Publish on GitHub Pages

The **Voice guides** workflow builds the public site from `main`. Choose **GitHub Actions** as the source in [Pages settings](https://github.com/bepobepo/Melbourne-guide/settings/pages). Choose one of these ways to supply narration.

- **Pages only.** Set `INWORLD_API_KEY` as a [repository Actions secret](https://github.com/bepobepo/Melbourne-guide/settings/secrets/actions/new). The workflow requests the 20 tracks from Inworld, uploads the MP3s with the site, and reuses unchanged recordings from its build cache while available. Each phone downloads only the recordings someone plays. Future builds may regenerate recordings if GitHub evicts the build cache.
- **Generate on first play.** Deploy the included [voice backend](backend/README.md). Store `INWORLD_API_KEY` in the backend's secret manager and set the GitHub Actions repository variable `VOICE_WORKER_URL` to its public HTTPS `/audio` endpoint. The backend accepts only the guide's predefined tracks and shares completed recordings across listeners. Deployment checks request one track in each language.

A push to `main` starts the workflow. After configuring the repository, you can also select **Run workflow** on the [Voice guides workflow](https://github.com/bepobepo/Melbourne-guide/actions/workflows/voice-guides.yml). Its deployment reports the app URL and checks the public guide and installation page.

The browser receives public audio and, when configured, the public backend address. The Inworld key belongs only in the server or Actions secret named above. To generate the static recordings locally with a securely configured environment, run `node scripts/generate-audio.mjs`. The development server serves these files from `audio/` with `npm start`.
