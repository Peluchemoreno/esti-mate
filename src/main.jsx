// main.jsx
import * as Sentry from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./components/App/App";
import "./shims/buffer";
import "./vendor/normalize.css";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./components/Toast/Toast.jsx";
import { initSentry } from "./sentry";

initSentry();

const queryClient = new QueryClient();

const AppWithSentry = Sentry.withErrorBoundary(App, {
  fallback: <p>An error has occurred</p>,
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AppWithSentry />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
