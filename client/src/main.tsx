import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

Sentry.init({
  dsn: "https://2fa0c7be390c12400f86f5f8bf0ea3c6@o4511213100400640.ingest.de.sentry.io/4511214417150032",
  sendDefaultPii: true,
});

// Read runtime config injected by the host before booting the app
const runtimeConfig = (window as unknown as { __SNAPSYNC_CONFIG__?: { version: string } }).__SNAPSYNC_CONFIG__;
console.info(`Booting SnapSync ${runtimeConfig.version}`);

createRoot(document.getElementById("root")!).render(<App />);
