# Orbit Live Call

Orbit Live Call is a **Jitsi-based video meeting app with listener-side real-time voice translation**. The normal Jitsi meeting experience stays intact; Orbit adds a Translator button to the meeting toolbar and a dedicated translator sidebar on the **left side** of the call.

The translator is intentionally listener-side: every participant can choose their own target language without changing the language heard by anyone else in the meeting.

## Live Translator flow

1. Join an Orbit/Jitsi meeting.
2. Tap **Translator** in the bottom meeting toolbar.
3. Orbit opens the **Live Translator** panel on the left. Jitsi Chat and Participants remain separate.
4. Choose **Translate incoming audio to** and select the listener's target language.
5. Press **Start Translation**.
6. Orbit reads **remote incoming Jitsi audio tracks only**. It does not send the listener's own microphone to the translator.
7. Remote participant audio and audio published with a shared screen are streamed as 16 kHz PCM to Gemini Live Translation.
8. The panel shows the original transcription and translated transcription as meeting history, with the best available participant/source label.
9. Gemini's translated 24 kHz PCM audio **autoplays**.
10. While translated speech is playing, Orbit ducks the original meeting audio to about 15%, then restores it when translated playback finishes.
11. Changing the target language refreshes only the translation session; it does not reconnect the Jitsi meeting.
12. Press **Stop Translation** or close the panel to stop capture, close the Live session, stop pending TTS playback, and restore normal meeting volume.

### Audio path

```text
Remote participant audio ─┐
                          ├─> Orbit remote-track capture
Shared-screen audio ──────┘
                                  │
                                  v
                         16 kHz PCM stream
                                  │
                                  v
                         Gemini Live Translation
                          │                  │
                          │                  └─> translated 24 kHz PCM -> autoplay
                          └─> original + translated transcript -> left sidebar
```

## Important implementation files

| File | Responsibility |
| --- | --- |
| `vendor/jitsi/index.html` | Orbit-branded Jitsi meeting configuration and custom toolbar buttons |
| `vendor/jitsi/orbit-extension.js` | Translator UI, remote-track capture, Gemini Live WebSocket, transcript history, TTS autoplay, audio ducking |
| `src/routes/api.translate-token.ts` | Server-only ephemeral Gemini token endpoint |
| `src/routes/api.translation-languages.ts` | Supported target-language list |
| `src/lib/translation-languages.ts` | Translation language registry |
| `server/middleware/z-orbit-jitsi.ts` | Serves/proxies the Orbit/Jitsi runtime from Nitro/Vercel |
| `scripts/jitsi-brand.mjs` | Jitsi asset proxy and Orbit overrides |
| `scripts/copy-jitsi-assets.mjs` | Copies vendored Jitsi assets into the generated server runtime bundle |

## Requirements

- Node.js **20.19+**
- npm
- A Gemini API key with access to the Live Translation model used by the server
- A modern browser with WebRTC, Web Audio, and WebSocket support

## Environment variables

Copy the example file for local development:

```bash
cp .env.example .env
```

Required:

```bash
GEMINI_API_KEY=your_server_side_key
```

`GEMINI_API_KEY` must stay **server-side**. Do not rename it with a `VITE_` prefix because Vite-prefixed variables are intended for client bundles.

Optional donation checkout:

```bash
STRIPE_SECRET_KEY=sk_...
```

If `STRIPE_SECRET_KEY` is not configured, the Donate panel remains in demo mode and no payment is taken.

## Local development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:8080
```

For a realistic translator test, join the same room from **two separate browser profiles/devices**. Start the translator on only one listener and speak from the other participant.

## Verification

Check the translator extension syntax:

```bash
npm run check:translator
```

Type-check the server/client TypeScript:

```bash
npm run typecheck
```

Build the Vercel/Nitro output:

```bash
npm run build
```

## Deploy to Vercel

This repository is configured as a **TanStack Start** project and uses **Nitro** with the Vercel preset. `vercel.json` explicitly declares the framework so Vercel can apply the correct build/output behavior.

### Option A — Git integration

1. Import this GitHub repository into Vercel.
2. Leave the framework as **TanStack Start**.
3. Add `GEMINI_API_KEY` under **Project Settings -> Environment Variables** for Production and Preview as needed.
4. Add `STRIPE_SECRET_KEY` only if live donations are enabled.
5. Deploy.

Vercel will run the repository build script:

```bash
npm run build
```

The build creates the Nitro/Vercel server output and then copies `vendor/jitsi` into the server function runtime so Orbit's custom Jitsi HTML, icons, and translator extension are available at runtime.

### Option B — Vercel CLI

```bash
npm install
npx vercel
```

Production:

```bash
npx vercel --prod
```

Configure secrets in Vercel rather than committing them to this repository.

## Runtime architecture

```text
Browser
  |
  +--> Orbit/Jitsi meeting UI
  |       |
  |       +--> Jitsi signaling/media via configured upstream
  |       |
  |       +--> orbit-extension.js
  |               |
  |               +--> remote Jitsi audio tracks
  |               +--> /api/translation-languages
  |               +--> /api/translate-token
  |                          |
  |                          +--> server-side GEMINI_API_KEY
  |                          +--> constrained ephemeral token
  |               |
  |               +--> Gemini Live Translation WebSocket
  |
  +--> Nitro/Vercel server middleware
          |
          +--> local Orbit/Jitsi vendor overrides
          +--> Jitsi upstream asset/signaling proxy
```

## Security model

The long-lived Gemini API key is never sent to the meeting browser. The browser requests a **short-lived constrained token** from `/api/translate-token`. That token is restricted to the configured Live Translation model/session settings and is used by the browser for the Live WebSocket connection.

Do not commit `.env`, Vercel tokens, Gemini keys, or Stripe secret keys.

## Current translator behavior

- Translator panel opens on the **left**.
- Chat and Participants remain independent Jitsi panels.
- Translation starts only after the listener presses **Start Translation**.
- Local microphone audio is excluded.
- Incoming remote audio is captured from Jitsi tracks.
- Shared-screen audio is included when Jitsi exposes it as an incoming audio track.
- Original and translated transcripts are retained as history.
- Speaker/source labels use Jitsi participant metadata plus per-track audio-level estimation.
- Translated speech autoplays.
- Original call audio is ducked during translated TTS playback.
- The translation session follows remote-track changes and reconnects when necessary.
- Closing/stopping translation restores normal meeting audio.

## Upstream Jitsi

The current Orbit vendor proxy is configured against `meet.ffmuc.net` for conference signaling and the Jitsi CDN snapshot declared in `scripts/jitsi-brand.mjs`. If the upstream host or snapshot changes, update those values and regression-test joining, media, screen sharing, toolbar injection, and translation before production rollout.

## License

This repository contains Orbit integration code plus vendored/overridden Jitsi-facing assets. Review and preserve the applicable upstream Jitsi licensing/attribution requirements when distributing a production build.
