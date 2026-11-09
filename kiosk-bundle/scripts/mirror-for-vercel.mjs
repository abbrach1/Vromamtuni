// Used only by the Vercel "kiosk-bundle" service (see /vercel.json), which
// serves this bundle at /kiosk-shell/ as a browser preview of the tablet.
//
// The tablet zip is built with plain `npm run build` and never includes this.
//
// Assets use relative URLs (vite base "./"), so the page works under any path.
// What we don't know for certain is whether Vercel hands the service the full
// path (/kiosk-shell/assets/x.js) or strips the /kiosk-shell prefix
// (/assets/x.js). To work either way, the build output is also copied into
// dist/kiosk-shell/. Once `vercel dev` (or a deploy) shows which one is used,
// this step can be removed if it isn't needed.
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
const prefix = join(dist, "kiosk-shell");
mkdirSync(prefix, { recursive: true });
for (const name of readdirSync(dist)) {
  if (name === "kiosk-shell") continue;
  cpSync(join(dist, name), join(prefix, name), { recursive: true });
}
console.log("Mirrored dist/ into dist/kiosk-shell/");
