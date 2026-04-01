"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onDismiss: () => void;
}

export function Toast({ message, type = "success", onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 200);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`
        fixed bottom-20 left-4 right-4 z-50
        p-[var(--space-4)] rounded-[var(--radius-md)]
        font-[family-name:var(--font-body)] text-sm text-blanco
        transition-all duration-200
        ${type === "success" ? "bg-verde" : "bg-rojo"}
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
    >
      {message}
    </div>
  );
}
