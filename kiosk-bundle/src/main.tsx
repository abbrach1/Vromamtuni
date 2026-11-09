import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startRuntime } from "./runtime";
import { KioskFrame } from "./KioskFrame";

// Boot the fleet runtime (identity, check-in, OTA), then show the
// program's own /kiosk page: the same screens the talmidim use on the web.
void startRuntime();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <KioskFrame />
  </StrictMode>,
);
