"use client";

import { useState } from "react";
import { PatternCard } from "@/components/ui/PatternCard";
import { Toast } from "@/components/ui/Toast";

interface PatternData {
  id: string;
  pattern_key: string;
  pattern_value: Record<string, unknown>;
  confidence: number;
  last_updated: string;
}

interface PatronesViewProps {
  patterns: PatternData[];
}

export function PatronesView({ patterns: initialPatterns }: PatronesViewProps) {
  const [patterns, setPatterns] = useState(initialPatterns);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  async function handleDelete(patternKey: string) {
    const pattern = patterns.find((p) => p.pattern_key === patternKey);
    if (!pattern) return;

    const confirmed = window.confirm(
      `¿Eliminar el patrón "${patternKey}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    try {
      const response = await fetch("/api/patterns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pattern.id }),
      });

      if (!response.ok) throw new Error(`Error ${response.status}`);

      setPatterns((prev) => prev.filter((p) => p.id !== pattern.id));
      setToast({ message: "Patrón eliminado", type: "success" });
    } catch {
      setToast({ message: "No se pudo eliminar el patrón", type: "error" });
    }
  }

  if (patterns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] gap-[var(--space-4)]">
        <div className="text-6xl text-azul/30">◎</div>
        <p className="text-gris text-center">
          Todavía no hay patrones. Se aprenden con el uso diario.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {patterns.map((pattern) => (
        <PatternCard
          key={pattern.id}
          patternKey={pattern.pattern_key}
          patternValue={pattern.pattern_value}
          confidence={pattern.confidence}
          lastUpdated={pattern.last_updated}
          onDelete={handleDelete}
        />
      ))}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
