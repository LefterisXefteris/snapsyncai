import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// TEMP: intentional crash for Sentry test — REMOVE THIS LINE TO RESTORE
throw new Error("SENTRY_TEST_CRASH: intentional frontend boot failure");

createRoot(document.getElementById("root")!).render(<App />);
