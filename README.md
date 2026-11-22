# Melbourne Field Guide

A map, illustrated stops, history and local information for walking together in Melbourne’s CBD. The guide includes English and Russian.

Run `npm start` with Node.js 20 or later. The development server listens on port 5173. Change the port with `npm run dev -- --port 3000`. There are no package dependencies.

## Install and use offline

Open the guide once over HTTPS (or localhost during development) and allow it to finish downloading the map, text, photos and fonts. Install through the browser’s install menu, or choose **Share → Add to Home Screen** in iPhone Safari. The guide works in a browser tab as well. Location suggestions require the browser’s location permission.

## Static hosting

Run `npm run prepare:offline` after editing app files or assets. This updates `precache.js`, including the version used for cache updates. The development server generates this file in memory for each request. Serve the app’s static files over HTTPS with `index.html` as the directory index. Ship `sw.js`, `precache.js`, `manifest.webmanifest`, icons, styles, scripts and media together.
