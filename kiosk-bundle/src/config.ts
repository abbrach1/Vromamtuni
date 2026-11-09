/**
 * Where the bundle talks to.
 *
 * Two origins, deliberately separate:
 *  - OUR_ORIGIN  — the PDCA fleet backend. Check-in, commands, and the default
 *                  OTA manifest live here. Known and fixed; never his.
 *  - DATA_ORIGIN — the program site (Vercel + Firebase). The tablet
 *                  shows its /kiosk page, so the talmidim see exactly what
 *                  the web app shows, and every Vercel deploy reaches the
 *                  tablets straight away. Set by the publish workflow from the
 *                  KIOSK_DATA_ORIGIN repository variable.
 *
 * Both are build-time env (VITE_*), so publishing a bundle bakes them in.
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

/** The page the tablet shows. */
export const KIOSK_URL: string = DATA_ORIGIN ? `${DATA_ORIGIN}/kiosk` : "";
/** If the page hasn't said it's ready by then, show the offline screen. */
export const KIOSK_READY_TIMEOUT_MS = 25_000;
/** How often the offline screen tries again. */
export const KIOSK_RETRY_MS = 15_000;
