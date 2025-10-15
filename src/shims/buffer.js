// src/shims/buffer.js
// Minimal safe polyfill for @react-pdf in the browser

import * as buffer from "buffer";

if (!globalThis.Buffer) {
  globalThis.Buffer = buffer.Buffer;
}

// Optional: placate libs that expect process.env
if (!globalThis.process) {
  globalThis.process = { env: {} };
}
