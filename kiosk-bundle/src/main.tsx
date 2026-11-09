import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startRuntime } from "./runtime";
import { Status } from "./Status";

// Boot the fleet runtime (identity, check-in, OTA) and render.
// Phase 2 next step: replace <Status/> with this repo's <KioskApp/>, pointed at
// his /api/kiosk/* via DATA_ORIGIN and his Firebase web config.
void startRuntime();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Status />
  </StrictMode>,
);
