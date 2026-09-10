import { installSessionGuard } from './lib/sessionGuard';
import { removeLegacyCredentials } from './lib/authStorage';
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./polyfills";
import "./index.css";
import App from "./App";
import { initPostHog } from "./lib/posthog";

removeLegacyCredentials();
initPostHog();

installSessionGuard();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
