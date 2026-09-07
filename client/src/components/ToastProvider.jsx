import { useCallback, useMemo, useState } from "react";
import { ToastContext } from "./ToastContext";

let nextToastId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback((message, type = "success") => {
    const toastId = nextToastId++;
    setToasts((current) => [...current, { id: toastId, message, type }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== toastId));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            className={`toast toast--${toast.type}`}
            key={toast.id}
            role="status"
          >
            <span>{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              className="toast__close"
              onClick={() => dismissToast(toast.id)}
              type="button"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
