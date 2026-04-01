"use client";

interface TimeBlockProps {
  taskId: string;
  title: string;
  projectName?: string;
  startTime: string;
  endTime: string;
  energyLevel: "low" | "medium" | "high";
  slotType: string;
  completed: boolean;
  estimatedMinutes?: number;
  featured?: boolean;
  onToggle: (taskId: string) => void;
}

const energyDotColors = {
  low: "bg-azul-light",
  medium: "bg-amarillo",
  high: "bg-rojo",
};

const energyIcons = {
  low: null,
  medium: "⚡",
  high: "⚡",
};

const slotLabels: Record<string, string> = {
  deep_work: "Deep work",
  admin: "Admin",
  client_work: "Client",
  learning: "Learning",
  personal: "Personal",
  maintenance: "Maintenance",
};

export function TimeBlock({
  taskId,
  title,
  projectName,
  startTime,
  endTime,
  energyLevel,
  slotType,
  completed,
  estimatedMinutes,
  featured = false,
  onToggle,
}: TimeBlockProps) {
  if (slotType === "break") {
    return (
      <div className="flex items-center justify-center py-[var(--space-2)]">
        <span className="text-xs text-gris">— Descanso {startTime} - {endTime} —</span>
      </div>
    );
  }

  const label = slotLabels[slotType] ?? slotType;
  const minutes = estimatedMinutes ?? "";

  return (
    <button
      onClick={() => onToggle(taskId)}
      className={`
        w-full text-left rounded-[var(--radius-lg)] p-[var(--space-4)]
        flex items-center gap-[var(--space-3)] transition-all duration-200
        ${featured
          ? "bg-bg-card-elevated shadow-[var(--shadow-md)]"
          : "bg-bg-card"
        }
        ${completed ? "opacity-50" : ""}
      `}
    >
      {/* Energy dot */}
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${energyDotColors[energyLevel]}`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-base text-blanco font-medium ${completed ? "line-through" : ""}`}>
          {title}
        </p>
        <p className="text-xs text-gris mt-0.5">
          {projectName ?? label}
          {minutes ? ` · ${minutes} min` : ""}
        </p>
      </div>

      {/* Right icon */}
      <div className="flex-shrink-0 text-lg">
        {completed ? (
          <span className="text-verde">✓</span>
        ) : energyIcons[energyLevel] ? (
          <span className="opacity-40">{energyIcons[energyLevel]}</span>
        ) : null}
      </div>
    </button>
  );
}
