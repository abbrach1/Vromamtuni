# Shabbos-Program kiosk bundle

The wall-tablet kiosk, packaged to run inside the **PDCA kiosk native shell**
(device-owner lockdown, remote management) instead of a hand-locked browser.
This folder builds the **OTA bundle** the shell downloads and runs — the tablet
*is* this bundle, served locally; it is not a web page in a browser.

**What the tablet shows:** the Shabbos Program's own `/kiosk` page, full
screen: the same screens the talmidim use on the web (tap your name, PIN,
the week, commitments, joining), in English or Hebrew. It's one copy of the
code, so the tablet and the web app can never drift apart, and every Vercel
deploy reaches the tablets straight away, with no new bundle needed.

## How it fits together

- **Native shell (PDCA):** lockdown, enrollment, remote commands, the OTA
  client. Provides the `KioskDevice` plugin and the check-in protocol.
- **This bundle:** `src/runtime.ts` is the fleet plumbing (identity, check-in
  to the PDCA origin, the device's own OTA channel, confirm-or-rollback).
  `src/KioskFrame.tsx` shows `<site>/kiosk` full screen around it. If the site
  can't be reached, it shows the device status and keeps retrying.
- **The site (Vercel + Firebase):** `/kiosk` and `/api/kiosk/*` are unchanged.
  Because the page runs on the site's own origin, the PIN routes need no CORS
  and no device token; the tablet code and PIN checks stay exactly as they are.
- **Touches:** the `/kiosk` page posts `ready` and `activity` messages to the
  shell, so an OTA swap never reloads the screen while a bachur is using it.

## Config

| Where | What |
| --- | --- |
| GitHub repository variable `KIOSK_DATA_ORIGIN` | The site's address, e.g. `https://shabbos.example.org`, no trailing slash. Settings → Secrets and variables → Actions → Variables. The publish workflow bakes it into the bundle (as `VITE_DATA_ORIGIN`). |
| `VITE_OUR_ORIGIN` (optional) | PDCA fleet backend; defaults to `https://tcpdca.com`. |
| Vercel `KIOSK_FRAME_ANCESTORS` (optional) | Which app origins may show `/kiosk` in a frame. Defaults to the Capacitor WebView origins `https://localhost http://localhost capacitor://localhost`. Every other page can only be framed by the site itself. Read at build time, so redeploy after changing it. |

**Native shell note:** the language button stores the choice in a cookie on
the site. Inside the shell that's a cross-site frame, so the shell's WebView
must accept third-party cookies (`CookieManager.setAcceptThirdPartyCookies(webView, true)`),
or the Hebrew/English choice won't stick between page loads.

## Build

```bash
cd kiosk-bundle
npm ci
VITE_DATA_ORIGIN=http://localhost:3000 npm run build   # -> dist/
```

To try it on a computer: run the site (`npm run dev` in the repo root, with
`KIOSK_FRAME_ANCESTORS=http://localhost:5173`), then serve `dist/` on port 5173
(e.g. `npx vite preview --port 5173`) and open http://localhost:5173.

## Publish (push an update)

Most changes need no new bundle at all: change `/kiosk` in the main app and
deploy to Vercel as usual; the tablets show it on their next load.

A new bundle is only needed when this folder changes (the runtime or the
frame). Push a tag `kiosk-v<version>` (e.g. `kiosk-v0.2.0`) or run "Publish
kiosk bundle" from the Actions tab. It builds, zips, creates a GitHub Release
with the zip, and writes `public/kiosk-manifest.json` on the default branch,
served at `https://<site>/kiosk-manifest.json` (the URL to set as each
tablet's `ota_manifest_url`). Releases must be downloadable without signing
in, so the repo must be public (the bundle holds no secrets).
