"use client";

import { useState } from "react";

interface ReflectionData {
  completion_rate: number;
  tasks_completed: number;
  tasks_deferred: number;
  reflection: string;
  patterns_written: number;
  tomorrow_priorities: string[];
}

interface ReflectionModalProps {
  open: boolean;
  onClose: () => void;
  planDate: string;
}

export function ReflectionModal({ open, onClose, planDate }: ReflectionModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReflectionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReflect() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/agents/accountability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_date: planDate }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? `Error ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-bg-surface/95 backdrop-blur-xl rounded-t-[28px] border-t border-blanco/5 animate-fade-slide-up"
        style={{ maxHeight: "85vh" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-blanco/15" />
        </div>

        <div className="px-(--space-4) pb-(--space-6) overflow-y-auto" style={{ maxHeight: "calc(85vh - 20px)" }}>
          {/* Title */}
          <h2 className="font-[family-name:var(--font-heading)] text-xl text-blanco italic text-center mb-(--space-6)">
            Reflexión del día
          </h2>

          {/* Initial state — not yet reflected */}
          {!data && !loading && !error && (
            <div className="flex flex-col items-center gap-(--space-6)">
              <p className="text-gris text-sm text-center font-[family-name:var(--font-body)] max-w-[280px]">
                Latido analizará tu día, generará una reflexión y aprenderá de tus patrones para planificar mejor mañana.
              </p>

              <div className="flex flex-col items-center gap-(--space-2) text-xs text-gris/60 font-[family-name:var(--font-body)]">
                <span>Las tareas no completadas se marcarán como diferidas.</span>
              </div>

              <button
                onClick={handleReflect}
                className="w-full bg-terracotta text-blanco font-[family-name:var(--font-body)] font-semibold text-base py-(--space-4) rounded-(--radius-lg) active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(212,113,75,0.25)]"
              >
                Cerrar mi día
              </button>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center gap-(--space-4) py-(--space-8)">
              <svg className="animate-spin h-8 w-8 text-terracotta" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-gris text-sm font-[family-name:var(--font-body)]">
                Analizando tu día...
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center gap-(--space-4)">
              <p className="text-rojo text-sm font-[family-name:var(--font-body)] text-center">
                {error}
              </p>
              <button
                onClick={handleReflect}
                className="text-azul text-sm font-[family-name:var(--font-body)] font-medium"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Results */}
          {data && (
            <div className="flex flex-col gap-(--space-6) animate-fade-in">
              {/* Stats row */}
              <div className="flex justify-center gap-(--space-6)">
                <StatCircle
                  value={data.tasks_completed}
                  label="completadas"
                  color="text-verde"
                />
                <StatCircle
                  value={data.tasks_deferred}
                  label="diferidas"
                  color="text-amarillo"
                />
                <StatCircle
                  value={data.completion_rate}
                  label="% cumplido"
                  color="text-azul"
                  isPercentage
                />
              </div>

              {/* Reflection text */}
              <div className="bg-bg-card rounded-(--radius-lg) p-(--space-4) border border-blanco/[0.04]">
                <p className="text-blanco text-sm font-[family-name:var(--font-body)] leading-relaxed italic">
                  &ldquo;{data.reflection}&rdquo;
                </p>
              </div>

              {/* Tomorrow priorities */}
              {data.tomorrow_priorities && data.tomorrow_priorities.length > 0 && (
                <div className="flex flex-col gap-(--space-3)">
                  <h3 className="text-xs text-gris tracking-[0.15em] uppercase font-[family-name:var(--font-body)] font-medium">
                    Prioridades para mañana
                  </h3>
                  <div className="flex flex-col gap-(--space-2)">
                    {data.tomorrow_priorities.map((priority, i) => (
                      <div key={i} className="flex items-center gap-(--space-3) bg-bg-card rounded-(--radius-md) p-(--space-3) border border-blanco/[0.04]">
                        <span className="text-xs text-azul font-[family-name:var(--font-heading)] italic w-5 text-center">
                          {i + 1}
                        </span>
                        <span className="text-sm text-blanco font-[family-name:var(--font-body)]">
                          {priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Patterns learned */}
              {data.patterns_written > 0 && (
                <p className="text-gris/60 text-xs text-center font-[family-name:var(--font-body)]">
                  {data.patterns_written} {data.patterns_written === 1 ? "patrón aprendido" : "patrones aprendidos"} para mañana
                </p>
              )}

              {/* Close button */}
              <button
                onClick={onClose}
                className="w-full bg-azul text-bg-primary font-[family-name:var(--font-body)] font-semibold text-base py-(--space-4) rounded-(--radius-lg) active:scale-[0.98] transition-all shadow-[0_4px_16px_rgba(59,143,228,0.25)]"
              >
                Listo
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatCircle({
  value,
  label,
  color,
  isPercentage = false,
}: {
  value: number;
  label: string;
  color: string;
  isPercentage?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-16 h-16 rounded-full bg-bg-card border border-blanco/[0.06] flex items-center justify-center">
        <span className={`text-xl font-[family-name:var(--font-heading)] italic ${color}`}>
          {isPercentage ? `${value}` : value}
        </span>
      </div>
      <span className="text-[10px] text-gris font-[family-name:var(--font-body)]">
        {label}
      </span>
    </div>
  );
}
