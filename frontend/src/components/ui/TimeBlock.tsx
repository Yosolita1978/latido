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
  onToggle: (taskId: string) => void;
}

const energyColors = {
  low: "bg-energy-low",
  medium: "bg-energy-medium",
  high: "bg-energy-high",
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
  onToggle,
}: TimeBlockProps) {
  if (slotType === "break") {
    return (
      <div className="flex items-center gap-[var(--space-4)] p-[var(--space-4)] border-2 border-dashed border-gris/30 rounded-[var(--radius-md)]">
        <span className="text-sm text-gris">{startTime} - {endTime}</span>
        <span className="text-gris italic">Descanso</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-[var(--space-4)] bg-blanco rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] overflow-hidden">
      <div className={`w-1 self-stretch ${energyColors[energyLevel]}`} />
      <div className="flex-1 py-[var(--space-3)] pr-[var(--space-2)]">
        <span className="text-sm text-gris">{startTime} - {endTime}</span>
        <p className={`text-base text-negro ${completed ? "line-through opacity-50" : ""}`}>
          {title}
        </p>
        {projectName && <p className="text-sm text-gris">{projectName}</p>}
      </div>
      <button
        onClick={() => onToggle(taskId)}
        className={`
          w-8 h-8 mr-[var(--space-4)] rounded-full border-2 flex-shrink-0
          flex items-center justify-center transition-colors duration-150
          ${completed
            ? "bg-verde border-verde text-blanco"
            : "border-azul bg-transparent hover:bg-azul/10"
          }
        `}
        aria-label={completed ? "Marcar como pendiente" : "Marcar como completada"}
      >
        {completed && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
