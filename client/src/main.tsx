import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

Sentry.init({
  dsn: "https://2fa0c7be390c12400f86f5f8bf0ea3c6@o4511213100400640.ingest.de.sentry.io/4511214417150032",
  sendDefaultPii: true,
});

// TEMP: intentional crash for Sentry test — REMOVE THIS LINE TO RESTORE
throw new Error("SENTRY_TEST_CRASH: intentional frontend boot failure");

createRoot(document.getElementById("root")!).render(<App />);
