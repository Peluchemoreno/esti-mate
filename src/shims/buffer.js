// Minimal safe polyfill for @react-pdf in the browser
import { Buffer } from "buffer";

if (!globalThis.Buffer) {
  // attach to window/global for libraries that assume Node-like env
  globalThis.Buffer = Buffer;
}
// Optional: placate libs that poke at process.env
if (!globalThis.process) {
  globalThis.process = { env: {} };
}
