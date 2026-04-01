"use client";

const PATTERN_LABELS: Record<string, string> = {
  avg_completion_rate: "Tasa de completado promedio",
  peak_energy_window: "Tu mejor hora para trabajo profundo",
  chronic_deferrals: "Tareas que siempre pospones",
  overestimation_factor: "Cuánto sobreestimas el tiempo",
  best_day_for_deep_work: "Tu mejor día para concentrarte",
  worst_day_for_deep_work: "Tu día más disperso",
  typical_break_duration: "Duración típica de descanso",
  meeting_recovery_time: "Tiempo de recuperación post-reunión",
  category_preferences: "Tipos de tarea que prefieres",
  planning_accuracy: "Precisión de tus planes",
};

interface PatternCardProps {
  patternKey: string;
  patternValue: Record<string, unknown>;
  confidence: number;
  lastUpdated: string;
  onDelete: (patternKey: string) => void;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

export function PatternCard({ patternKey, patternValue, confidence, lastUpdated, onDelete }: PatternCardProps) {
  const label = PATTERN_LABELS[patternKey] ?? patternKey;

  return (
    <div className="bg-bg-card rounded-[var(--radius-lg)] p-[var(--space-4)]">
      <div className="flex items-start justify-between gap-[var(--space-2)]">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-blanco">{label}</h3>
          <p className="text-sm text-gris mt-[var(--space-1)]">
            {JSON.stringify(patternValue)}
          </p>
          <div className="flex items-center gap-[var(--space-3)] mt-[var(--space-2)]">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((dot) => (
                <span
                  key={dot}
                  className={`w-2 h-2 rounded-full ${
                    dot <= confidence ? "bg-azul" : "bg-blanco/10"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-gris">{formatTimeAgo(lastUpdated)}</span>
          </div>
        </div>
        <button
          onClick={() => onDelete(patternKey)}
          className="text-rojo hover:bg-rojo/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0"
          aria-label="Eliminar patrón"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
