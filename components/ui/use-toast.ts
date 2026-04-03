"use client";

import * as React from "react";

export type ToastVariant = "default" | "success" | "error";

export type ToastMessage = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

type ToastStore = {
  toasts: ToastMessage[];
  listeners: Set<() => void>;
};

const store: ToastStore = {
  toasts: [],
  listeners: new Set(),
};

function emitChange() {
  store.listeners.forEach((listener) => listener());
}

function createId() {
  return Math.random().toString(36).slice(2, 11);
}

function pushToast(input: ToastInput) {
  const nextToast: ToastMessage = {
    id: createId(),
    title: input.title,
    description: input.description,
    variant: input.variant ?? "default",
  };

  store.toasts = [...store.toasts, nextToast].slice(-3);
  emitChange();

  window.setTimeout(() => {
    store.toasts = store.toasts.filter((toast) => toast.id !== nextToast.id);
    emitChange();
  }, 3200);

  return nextToast;
}

export const toast = Object.assign(
  (input: ToastInput) => pushToast(input),
  {
    success(title: string, description?: string) {
      return pushToast({ title, description, variant: "success" });
    },
    error(title: string, description?: string) {
      return pushToast({ title, description, variant: "error" });
    },
  },
);

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastMessage[]>(store.toasts);

  React.useEffect(() => {
    const listener = () => setToasts([...store.toasts]);
    store.listeners.add(listener);
    listener();
    return () => {
      store.listeners.delete(listener);
    };
  }, []);

  return {
    toasts,
    toast,
  };
}
