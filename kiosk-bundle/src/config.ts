/**
 * Where the bundle talks to.
 *
 * Two origins, deliberately separate:
 *  - OUR_ORIGIN  — the PDCA fleet backend. Check-in, commands, and the default
 *                  OTA manifest live here. Known and fixed; never his.
 *  - DATA_ORIGIN — HIS app (Vercel + Firebase): the /api/kiosk/* routes the
 *                  kiosk UI calls for names, PINs and progress. Filled in once
 *                  the production domain is known; blank until then.
 *
 * Both are build-time env (VITE_*), so publishing a bundle bakes them in. The
 * Firebase web config (also his, also public) comes in the same way when the UI
 * is wired.
 */
export const OUR_ORIGIN: string =
  (import.meta.env.VITE_OUR_ORIGIN as string | undefined)?.replace(/\/$/, "") ||
  "https://tcpdca.com";

export const DATA_ORIGIN: string =
  (import.meta.env.VITE_DATA_ORIGIN as string | undefined)?.replace(/\/$/, "") || "";

/** How often the tablet calls our fleet home. */
export const CHECKIN_INTERVAL_MS = 60_000;
/** How often it polls its OTA manifest. */
export const OTA_POLL_INTERVAL_MS = 15 * 60_000;
/** Seconds of no touch before an OTA swap is allowed to reload the screen. */
export const OTA_IDLE_BEFORE_APPLY_MS = 30_000;
