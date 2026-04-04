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

const PATTERN_ICONS: Record<string, string> = {
  avg_completion_rate: "◉",
  peak_energy_window: "◈",
  chronic_deferrals: "◇",
  overestimation_factor: "◆",
  best_day_for_deep_work: "▣",
  worst_day_for_deep_work: "▤",
  typical_break_duration: "○",
  meeting_recovery_time: "●",
  category_preferences: "◎",
  planning_accuracy: "◐",
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

function formatPatternValue(value: Record<string, unknown>): string {
  const observation = value.observation ?? value.description ?? value.summary;
  if (typeof observation === "string") return observation;

  // For simple key-value patterns, format nicely
  const entries = Object.entries(value)
    .filter(([k]) => k !== "observation" && k !== "description")
    .slice(0, 3);

  return entries.map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(", ");
}

export function PatternCard({ patternKey, patternValue, confidence, lastUpdated, onDelete }: PatternCardProps) {
  const label = PATTERN_LABELS[patternKey] ?? patternKey;
  const icon = PATTERN_ICONS[patternKey] ?? "◉";

  return (
    <div className="bg-bg-card rounded-(--radius-lg) p-(--space-4) border border-blanco/[0.04] card-glow">
      <div className="flex items-start gap-(--space-3)">
        {/* Icon */}
        <span className="text-azul/50 text-lg mt-0.5 flex-shrink-0">{icon}</span>

        <div className="flex-1 min-w-0">
          <h3 className="text-[0.938rem] font-semibold text-blanco font-[family-name:var(--font-body)]">
            {label}
          </h3>
          <p className="text-sm text-gris mt-(--space-1) leading-relaxed">
            {formatPatternValue(patternValue)}
          </p>
          <div className="flex items-center gap-(--space-3) mt-(--space-2)">
            {/* Confidence dots */}
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((dot) => (
                <span
                  key={dot}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    dot <= confidence ? "bg-azul" : "bg-blanco/[0.06]"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-gris/60">{formatTimeAgo(lastUpdated)}</span>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={() => onDelete(patternKey)}
          className="text-gris/40 hover:text-rojo rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 transition-colors"
          aria-label="Eliminar patrón"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
