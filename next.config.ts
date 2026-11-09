import type { NextConfig } from "next";

/**
 * Who may show these pages inside a frame.
 *
 * The wall tablets run the kiosk shell app, which shows this site's /kiosk
 * page inside its own screen (see kiosk-bundle/). So /kiosk may be framed by
 * the shell (its WebView origin) and by this site; every other page by this
 * site only, so nobody can wrap the staff or bachur pages in another site.
 * Override the shell's origins with KIOSK_FRAME_ANCESTORS (space-separated).
 */
const kioskAncestors =
  process.env.KIOSK_FRAME_ANCESTORS ?? "https://localhost http://localhost capacitor://localhost";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path((?!kiosk$).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
      {
        source: "/kiosk",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${kioskAncestors}` }],
      },
    ];
  },
};

export default nextConfig;
