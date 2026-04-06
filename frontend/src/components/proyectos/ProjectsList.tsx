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

interface ProjectsListProps {
  projects: Project[];
}

export function ProjectsList({ projects: initialProjects }: ProjectsListProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHours, setNewHours] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
        }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const project = await response.json();
      setProjects((prev) => [...prev, project]);
      setNewName("");
      setNewHours("");
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

  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "blocked");
  const inactiveProjects = projects.filter((p) => p.status === "paused" || p.status === "wishlist");

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* Add project button / form */}
      {showAdd ? (
        <div className="bg-bg-card rounded-[var(--radius-lg)] p-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
          <input
            type="text"
            placeholder="Nombre del proyecto"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full p-[var(--space-3)] bg-bg-card-elevated text-blanco rounded-[var(--radius-md)] border border-blanco/10 focus:border-azul focus:outline-none text-sm font-[family-name:var(--font-body)]"
          />
          <input
            type="number"
            placeholder="Horas por semana (opcional)"
            value={newHours}
            onChange={(e) => setNewHours(e.target.value)}
            className="w-full p-[var(--space-3)] bg-bg-card-elevated text-blanco rounded-[var(--radius-md)] border border-blanco/10 focus:border-azul focus:outline-none text-sm font-[family-name:var(--font-body)]"
          />
          <div className="flex gap-[var(--space-2)]">
            <Button onClick={handleAdd} disabled={loading || !newName.trim()} className="flex-1">
              Crear
            </Button>
            <Button variant="ghost" onClick={() => { setShowAdd(false); setNewName(""); setNewHours(""); }} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-[var(--space-4)] rounded-[var(--radius-lg)] border-2 border-dashed border-blanco/10 text-gris text-sm hover:border-azul hover:text-azul transition-colors"
        >
          + Nuevo proyecto
        </button>
      )}

      {/* Active projects */}
      {activeProjects.length > 0 && (
        <div className="flex flex-col gap-[var(--space-2)]">
          <span className="text-xs text-gris tracking-widest uppercase">Activos</span>
          <div className="flex flex-col gap-[var(--space-3)]">
            {activeProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                expanded={expandedId === project.id}
                onToggleExpand={() => setExpandedId(expandedId === project.id ? null : project.id)}
                onStatusChange={handleStatusChange}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inactive projects */}
      {inactiveProjects.length > 0 && (
        <div className="flex flex-col gap-[var(--space-2)]">
          <span className="text-xs text-gris tracking-widest uppercase">Pausados / Wishlist</span>
          <div className="flex flex-col gap-[var(--space-3)]">
            {inactiveProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                expanded={expandedId === project.id}
                onToggleExpand={() => setExpandedId(expandedId === project.id ? null : project.id)}
                onStatusChange={handleStatusChange}
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
  loading,
}: {
  project: Project;
  expanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (id: string, status: string) => void;
  loading: boolean;
}) {
  const actions = getActions(project.status);

  return (
    <div className="bg-bg-card rounded-[var(--radius-lg)] overflow-hidden">
      <button
        onClick={onToggleExpand}
        className="w-full p-[var(--space-4)] flex items-center gap-[var(--space-3)] text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[var(--space-2)]">
            <span className="text-base text-blanco font-medium truncate">{project.name}</span>
            <Badge
              label={statusLabels[project.status] ?? project.status}
              className={statusColors[project.status] ?? "bg-gris/20 text-gris"}
            />
          </div>
          <div className="flex items-center gap-[var(--space-3)] mt-1">
            {project.hours_per_week_needed && (
              <span className="text-xs text-gris">{project.hours_per_week_needed}h/semana</span>
            )}
            <span className="text-xs text-gris">Prioridad {project.priority}</span>
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
        <div className="px-[var(--space-4)] pb-[var(--space-4)] flex gap-[var(--space-2)]">
          {actions.map((action) => (
            <button
              key={action.status}
              onClick={() => onStatusChange(project.id, action.status)}
              disabled={loading}
              className={`
                flex-1 py-[var(--space-2)] rounded-[var(--radius-md)] text-xs font-medium
                transition-colors disabled:opacity-50
                ${action.color}
              `}
            >
              {action.label}
            </button>
          ))}
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
