// src/components/Toast/Toast.jsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import "./Toast.css";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, opts = {}) => {
      const id = crypto.randomUUID?.() || String(Date.now() + Math.random());
      const type = opts.type || "info"; // info | success | error
      const durationMs = Number.isFinite(opts.durationMs)
        ? opts.durationMs
        : 2200;

      const toast = { id, message: String(message || ""), type };
      setToasts((prev) => [...prev, toast]);

      const timer = setTimeout(() => remove(id), durationMs);
      timersRef.current.set(id, timer);

      return id;
    },
    [remove]
  );

  const api = useMemo(
    () => ({
      push,
      remove,
      info: (msg, o) => push(msg, { ...o, type: "info" }),
      success: (msg, o) => push(msg, { ...o, type: "success" }),
      error: (msg, o) => push(msg, { ...o, type: "error" }),
    }),
    [push, remove]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toast stack */}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <div className="toast__msg">{t.message}</div>
            <button
              className="toast__close"
              onClick={() => remove(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
