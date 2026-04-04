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
      setTimeout(onDismiss, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`
        fixed bottom-20 left-4 right-4 z-50 max-w-lg mx-auto
        px-(--space-4) py-(--space-3) rounded-(--radius-md)
        font-[family-name:var(--font-body)] text-sm font-medium
        backdrop-blur-lg border
        transition-all duration-300
        ${type === "success"
          ? "bg-verde/10 text-verde border-verde/20"
          : "bg-rojo/10 text-rojo border-rojo/20"
        }
        ${visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4"
        }
      `}
    >
      {message}
    </div>
  );
}
