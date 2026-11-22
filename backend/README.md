# Optional Inworld streaming backend

The GitHub Pages site is static. Its preferred offline audio is generated before
deployment. This optional Cloudflare Worker generates a missing narration on
demand and streams MP3 bytes to the browser while retaining a verified copy.
Nothing in this folder has been deployed automatically.

## Configure and run

Use Node.js 20 or later and the Cloudflare Wrangler CLI. From the repository root:

```sh
npx wrangler dev --port 8787
```

`wrangler.jsonc` registers the `AUDIO_TRACKS` SQLite Durable Object binding and
migration. Local state is retained in the ignored `.wrangler/` directory. For
authenticated local testing, configure `INWORLD_API_KEY` through your backend's
secret manager or a private, ignored `.dev.vars` file. Never put the value in app
JavaScript, command arguments, logs, source control, or chat. Without the binding,
the audio endpoint returns a clear `503 voice_not_configured` response.

For public hosting, a Cloudflare account with Workers and SQLite Durable Objects
enabled is required. Review the account's usage limits and billing, authenticate
Wrangler, then deploy and securely configure the secret:

```sh
npx wrangler deploy
npx wrangler secret put INWORLD_API_KEY
```

The secret command asks for the value privately. Create a key in the Inworld
Portal if necessary. The provider must permit `api.inworld.ai` HTTPS access.
Configure the frontend's voice endpoint with the resulting Worker's `/audio`
address. `ALLOWED_ORIGINS` in `wrangler.jsonc` is a comma-separated list of complete
origins; it defaults to `https://bepobepo.github.io`. HTTP localhost and 127.0.0.1
origins are also allowed for development. CORS is a browser access rule, not
authentication; cost controls are enforced independently below.

```text
GET /audio?id=site%2Fflinders&lang=ru
```

Only IDs and languages from `voice-tracks.js` are accepted. Extra or duplicate
parameters, arbitrary text, custom voices, unsupported methods and unknown tracks
are rejected before synthesis. Successful responses use `audio/mpeg`; missing
configuration, provider failures and retry limits return safe JSON errors. A
provider error after streaming starts errors the response body, so clients must
not cache an incomplete response.

## Storage and paid request limits

Every text, voice and model revision has a globally unique Durable Object. It
coalesces concurrent listeners into one provider request and retains completed
audio in SQLite-backed storage. Cancelling playback does not discard a paid
generation already underway. A new object instance reuses persisted audio, even
when the provider key is temporarily unavailable.

Generation attempts are recorded durably before contacting Inworld. Each track
revision allows at most three attempts per rolling hour, with a five-minute
cooldown after an attempt. `Retry-After` tells clients when another attempt can
be made. These windows expire automatically so transient outages or corrected
credentials do not require database deletion. Do not add client retries in a
loop. The finite deployed track catalogue bounds the public synthesis inputs;
changes to narration or voice intentionally create a new version and budget.

Only a clean, fully parsed NDJSON stream with complete MPEG Layer III frames is
marked complete. Audio is capped at 16 MiB and upstream requests at two minutes;
at most 32 listeners attach concurrently. Partial responses never become cache
hits. Old audio revisions remain in Durable Object storage until deliberately
removed by an operator; account storage/usage monitoring is recommended.

## Shared synthesis API and tests

`await synthesize(track, apiKey, { fetch, signal, timeoutMs })`, exported by
`backend/inworld.js`, returns a web `ReadableStream<Uint8Array>`. The optional
`fetch` override supports deterministic tests. It maps the shared `TTS_SETTINGS`
to Inworld's HTTP streaming payload and uses `Authorization: Basic <api-key>`
without additional encoding. It rejects malformed, truncated or failed NDJSON
streams. File generators must consume to EOF and use `completeMp3` from `mp3.js`
before publishing a recording.

Run the simulated-provider checks without credentials:

```sh
node --test tests/backend.test.mjs
npx wrangler deploy --dry-run
```

These checks do not prove authenticated synthesis, audio quality or public
deployment. Those require a configured key and the appropriate backend account.
