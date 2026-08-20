"use client";

import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { ReactNode } from "react";

export interface Toast {
  id: string;
  tone: "success" | "danger" | "neutral";
  message: string;
  detail?: string;
}

interface ToastState {
  toasts: Toast[];
}

type ToastAction = { type: "add"; toast: Toast } | { type: "dismiss"; id: string };

const reducer = (state: ToastState, action: ToastAction): ToastState => {
  switch (action.type) {
    case "add":
      return { toasts: [...state.toasts, action.toast] };
    case "dismiss":
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
  }
};

let seq = 0;
const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${(seq += 1).toString(36)}`;

interface ToastContextValue extends ToastState {
  pushToast: (t: { tone?: Toast["tone"]; message: string; detail?: string; duration?: number }) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { toasts: [] });

  const dismissToast = useCallback((id: string) => dispatch({ type: "dismiss", id }), []);

  const pushToast = useCallback(
    (t: { tone?: Toast["tone"]; message: string; detail?: string; duration?: number }) => {
      const id = nextId("tt");
      dispatch({
        type: "add",
        toast: {
          id,
          tone: t.tone ?? "neutral",
          message: t.message,
          detail: t.detail,
        },
      });
      const duration = t.duration ?? DEFAULT_DURATION;
      if (duration > 0) {
        setTimeout(() => dismissToast(id), duration);
      }
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ ...state, pushToast, dismissToast }),
    [state, pushToast, dismissToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
