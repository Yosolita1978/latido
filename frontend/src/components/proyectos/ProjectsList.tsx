"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";

interface Project {
  id: string;
  name: string;
  status: string;
  hours_per_week_needed: number | null;
  priority: number;
}

const statusLabels: Record<string, string> = {
  active: "Activo",
  paused: "Pausado",
  blocked: "Bloqueado",
  wishlist: "Wishlist",
};

const statusColors: Record<string, string> = {
  active: "bg-verde/20 text-verde",
  paused: "bg-amarillo/20 text-amarillo",
  blocked: "bg-rojo/20 text-rojo",
  wishlist: "bg-gris/20 text-gris",
};

const priorityLabels: Record<number, string> = {
  1: "Alta",
  2: "Alta",
  3: "Media",
  4: "Baja",
  5: "Baja",
};

const priorityColors: Record<number, string> = {
  1: "text-rojo",
  2: "text-rojo",
  3: "text-amarillo",
  4: "text-gris",
  5: "text-gris",
};

const PRIORITY_OPTIONS = [
  { value: 1, label: "Alta", color: "bg-rojo/15 text-rojo border-rojo/30" },
  { value: 3, label: "Media", color: "bg-amarillo/15 text-amarillo border-amarillo/30" },
  { value: 5, label: "Baja", color: "bg-gris/15 text-gris border-gris/30" },
];

interface ProjectsListProps {
  projects: Project[];
  weeklyHoursAvailable: number;
}

export function ProjectsList({ projects: initialProjects, weeklyHoursAvailable }: ProjectsListProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHours, setNewHours] = useState("");
  const [newPriority, setNewPriority] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Sum hours from all active/blocked projects
  const committedHours = projects
    .filter((p) => p.status === "active" || p.status === "blocked")
    .reduce((sum, p) => sum + (p.hours_per_week_needed ?? 0), 0);

  const remainingHours = weeklyHoursAvailable - committedHours;
  const overcommitted = remainingHours < 0;
  const usagePercent = Math.min(100, (committedHours / weeklyHoursAvailable) * 100);

  async function handleAdd() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          hours_per_week_needed: newHours ? parseFloat(newHours) : null,
          priority: newPriority,
        }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const project = await response.json();
      setProjects((prev) => [...prev, project]);
      setNewName("");
      setNewHours("");
      setNewPriority(3);
      setShowAdd(false);
      setToast({ message: `Proyecto "${project.name}" creado`, type: "success" });
    } catch {
      setToast({ message: "No se pudo crear el proyecto", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    setLoading(true);
    try {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const updated = await response.json();
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setExpandedId(null);
      const label = statusLabels[newStatus] ?? newStatus;
      setToast({ message: `Proyecto marcado como ${label.toLowerCase()}`, type: "success" });
    } catch {
      setToast({ message: "No se pudo actualizar el proyecto", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handlePriorityChange(id: string, newPriorityValue: number) {
    setLoading(true);
    try {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, priority: newPriorityValue }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const updated = await response.json();
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setToast({ message: "Prioridad actualizada", type: "success" });
    } catch {
      setToast({ message: "No se pudo actualizar la prioridad", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "blocked");
  const inactiveProjects = projects.filter((p) => p.status === "paused" || p.status === "wishlist");

  return (
    <div className="flex flex-col gap-(--space-6)">
      {/* Hours summary */}
      <div className="bg-bg-card rounded-(--radius-lg) p-(--space-4) border border-blanco/[0.04]">
        <div className="flex items-baseline justify-between mb-(--space-2)">
          <span className="text-xs text-gris tracking-[0.15em] uppercase font-[family-name:var(--font-body)] font-medium">
            Horas comprometidas
          </span>
          <span className="font-[family-name:var(--font-heading)] text-xl text-blanco italic">
            <span className={overcommitted ? "text-rojo" : "text-blanco"}>{committedHours}</span>
            <span className="text-gris"> / {weeklyHoursAvailable}h</span>
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-blanco/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              overcommitted ? "bg-rojo" : usagePercent > 80 ? "bg-amarillo" : "bg-verde"
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        <p className="text-xs text-gris/60 mt-(--space-2) font-[family-name:var(--font-body)]">
          {overcommitted
            ? `Te pasaste por ${Math.abs(remainingHours)}h esta semana`
            : remainingHours === 0
              ? "Tu semana está al máximo"
              : `Tienes ${remainingHours}h libres en la semana`}
        </p>
      </div>

      {/* Add project button / form */}
      {showAdd ? (
        <div className="bg-bg-card rounded-(--radius-lg) p-(--space-4) flex flex-col gap-(--space-3)">
          <input
            type="text"
            placeholder="Nombre del proyecto"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full p-(--space-3) bg-bg-card-elevated text-blanco rounded-(--radius-md) border border-blanco/10 focus:border-azul focus:outline-none text-sm font-[family-name:var(--font-body)]"
          />
          <input
            type="number"
            placeholder="Horas por semana (opcional)"
            value={newHours}
            onChange={(e) => setNewHours(e.target.value)}
            className="w-full p-(--space-3) bg-bg-card-elevated text-blanco rounded-(--radius-md) border border-blanco/10 focus:border-azul focus:outline-none text-sm font-[family-name:var(--font-body)]"
          />

          {/* Priority selector */}
          <div className="flex flex-col gap-(--space-2)">
            <span className="text-xs text-gris/70 font-[family-name:var(--font-body)]">
              Prioridad
            </span>
            <div className="flex gap-(--space-2)">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNewPriority(opt.value)}
                  disabled={loading}
                  className={`
                    flex-1 px-(--space-3) py-1.5 rounded-full text-xs font-medium
                    font-[family-name:var(--font-body)] transition-all
                    ${newPriority === opt.value
                      ? opt.color + " border-2"
                      : "bg-bg-card-elevated text-gris border border-blanco/[0.06]"
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-(--space-2) mt-(--space-2)">
            <Button onClick={handleAdd} disabled={loading || !newName.trim()} className="flex-1">
              Crear
            </Button>
            <Button variant="ghost" onClick={() => { setShowAdd(false); setNewName(""); setNewHours(""); setNewPriority(3); }} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-(--space-4) rounded-(--radius-lg) border-2 border-dashed border-blanco/10 text-gris text-sm hover:border-azul hover:text-azul transition-colors"
        >
          + Nuevo proyecto
        </button>
      )}

      {/* Active projects */}
      {activeProjects.length > 0 && (
        <div className="flex flex-col gap-(--space-2)">
          <span className="text-xs text-gris tracking-widest uppercase">Activos</span>
          <div className="flex flex-col gap-(--space-3)">
            {activeProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                expanded={expandedId === project.id}
                onToggleExpand={() => setExpandedId(expandedId === project.id ? null : project.id)}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive projects */}
      {inactiveProjects.length > 0 && (
        <div className="flex flex-col gap-(--space-2)">
          <span className="text-xs text-gris tracking-widest uppercase">Pausados / Wishlist</span>
          <div className="flex flex-col gap-(--space-3)">
            {inactiveProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                expanded={expandedId === project.id}
                onToggleExpand={() => setExpandedId(expandedId === project.id ? null : project.id)}
                onStatusChange={handleStatusChange}
                onPriorityChange={handlePriorityChange}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

function ProjectCard({
  project,
  expanded,
  onToggleExpand,
  onStatusChange,
  onPriorityChange,
  loading,
}: {
  project: Project;
  expanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (id: string, status: string) => void;
  onPriorityChange: (id: string, priority: number) => void;
  loading: boolean;
}) {
  const actions = getActions(project.status);
  const priorityLabel = priorityLabels[project.priority] ?? "Media";
  const priorityColor = priorityColors[project.priority] ?? "text-amarillo";

  return (
    <div className="bg-bg-card rounded-(--radius-lg) overflow-hidden">
      <button
        onClick={onToggleExpand}
        className="w-full p-(--space-4) flex items-center gap-(--space-3) text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-(--space-2)">
            <span className="text-base text-blanco font-medium truncate">{project.name}</span>
            <Badge
              label={statusLabels[project.status] ?? project.status}
              className={statusColors[project.status] ?? "bg-gris/20 text-gris"}
            />
          </div>
          <div className="flex items-center gap-(--space-3) mt-1">
            {project.hours_per_week_needed && (
              <span className="text-xs text-gris">{project.hours_per_week_needed}h/semana</span>
            )}
            <span className={`text-xs ${priorityColor}`}>
              Prioridad {priorityLabel}
            </span>
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          className={`text-gris transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {expanded && (
        <div className="px-(--space-4) pb-(--space-4) flex flex-col gap-(--space-3)">
          {/* Priority selector */}
          <div className="flex flex-col gap-(--space-2)">
            <span className="text-xs text-gris/70 font-[family-name:var(--font-body)]">
              Cambiar prioridad
            </span>
            <div className="flex gap-(--space-2)">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onPriorityChange(project.id, opt.value)}
                  disabled={loading}
                  className={`
                    flex-1 px-(--space-3) py-1.5 rounded-full text-xs font-medium
                    font-[family-name:var(--font-body)] transition-all
                    ${project.priority === opt.value
                      ? opt.color + " border-2"
                      : "bg-bg-card-elevated text-gris border border-blanco/[0.06]"
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status actions */}
          <div className="flex gap-(--space-2)">
            {actions.map((action) => (
              <button
                key={action.status}
                onClick={() => onStatusChange(project.id, action.status)}
                disabled={loading}
                className={`
                  flex-1 py-(--space-2) rounded-(--radius-md) text-xs font-medium
                  transition-colors disabled:opacity-50
                  ${action.color}
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getActions(currentStatus: string) {
  const actions = [];

  if (currentStatus !== "active") {
    actions.push({ status: "active", label: "Activar", color: "bg-verde/20 text-verde" });
  }
  if (currentStatus !== "paused") {
    actions.push({ status: "paused", label: "Pausar", color: "bg-amarillo/20 text-amarillo" });
  }
  if (currentStatus !== "wishlist") {
    actions.push({ status: "wishlist", label: "Wishlist", color: "bg-gris/20 text-gris" });
  }

  return actions;
}
