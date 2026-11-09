# Shabbos-Program kiosk bundle

The wall-tablet kiosk, packaged to run inside the **PDCA kiosk native shell**
(device-owner lockdown, remote management) instead of a hand-locked browser.
This folder builds the **OTA bundle** the shell downloads and runs — the tablet
*is* this bundle, served locally; it is not a web page in a browser.

The rest of this repo is unchanged: the phone app and staff overview stay on
Vercel + Firebase. This bundle reuses this repo's kiosk UI and talks to the same
`/api/kiosk/*` routes and Firebase.

## How it fits together

- **Native shell (theirs, PDCA):** lockdown, enrollment, check-in, remote
  commands, the OTA client. Provides the `KioskDevice` plugin + check-in
  protocol. See the contract in the PDCA repo:
  `apps/kiosk-tablet/docs/partner-bundle-contract.md`.
- **This bundle:** `src/runtime.ts` is the fleet plumbing (identity → check-in
  to the PDCA origin → the device's own OTA channel → confirm-or-rollback). The
  UI sits on top of it.
- **Your backend:** this app's `/api/kiosk/*` on Vercel + Firestore. The bundle
  calls it over the network, so those routes need CORS for the shell origin and
  a device token (added in a follow-up PR).

## Config (build-time env)

| Var | What | Default |
|---|---|---|
| `VITE_OUR_ORIGIN` | PDCA fleet backend (check-in, OTA) | `https://tcpdca.com` |
| `VITE_DATA_ORIGIN` | **This app's** origin for `/api/kiosk/*` | _(set when the domain is known)_ |
| `VITE_FIREBASE_*` | Firebase web config (apiKey, authDomain, projectId, appId) | _(set when wiring the UI)_ |

`VITE_DATA_ORIGIN` and the Firebase config are the only things that still need
the production domain / Firebase project; everything else is wired.

## Build

```bash
cd kiosk-bundle
npm ci
npm run build      # -> dist/ (index.html + assets, relative paths)
```

## Publish (the partner's "push an update")

Handled by `.github/workflows/publish-kiosk-bundle.yml`: push a tag
`kiosk-v<version>` (e.g. `kiosk-v0.1.0`) or run it from the Actions tab. It
builds, zips, creates a **GitHub Release** with the zip (a stable public URL),
and writes `public/kiosk-manifest.json` — served at
`https://<your-domain>/kiosk-manifest.json`, which is the URL to set as each
tablet's `ota_manifest_url`. The repo/releases must be **public** (the tablet
downloads unauthenticated — so no secrets in the bundle).

## Status

- ✅ Build pipeline + fleet runtime + publish workflow.
- ⬜ **Next:** replace `src/Status.tsx` with this repo's `<KioskApp/>` (reused,
  pointed at `/api/kiosk/*` via `VITE_DATA_ORIGIN`), with small shims for the
  Next-only APIs it uses (`next/navigation`, and the server-computed week/parsha
  props moved client-side). Needs the Firebase web config + production domain.
- ⬜ PR to add CORS + a device token to `src/app/api/kiosk/*`.
