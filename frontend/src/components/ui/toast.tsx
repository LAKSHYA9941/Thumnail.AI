import * as React from "react";
import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: Toast["type"], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 4000);
  };

  const removeToast = (id: string) =>
    setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();
  return (
    <div className="fixed top-4 right-4 z-50 w-full max-w-sm">
      <div className="space-y-3">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </div>
  );
}

function Toast({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const icons = { success: CheckCircle, error: AlertCircle, info: Info };
  const Icon = icons[toast.type];

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-xl border p-4 text-sm font-medium shadow-2xl",
        "transition-all duration-300 ease-out",
        "animate-in slide-in-from-right-full fade-in-0",
        toast.type === "success" &&
          "border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-100",
        toast.type === "error" &&
          "border-red-500/50 bg-red-50 text-red-900 dark:border-red-400 dark:bg-red-950 dark:text-red-100",
        toast.type === "info" &&
          "border-blue-500/50 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-100"
      )}
    >
      <div className="flex-shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 pr-6">{toast.message}</div>
      <button
        onClick={() => onRemove(toast.id)}
        className="absolute top-1 right-1 rounded-full p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

/* Convenience helpers (API stays the same) */
export const toast = {
  success: (msg: string) => useToast().addToast("success", msg),
  error:   (msg: string) => useToast().addToast("error", msg),
  info:    (msg: string) => useToast().addToast("info", msg),
};