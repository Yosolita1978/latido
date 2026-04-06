import Image from "next/image";
import { callTool } from "@/lib/mcp-client";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Task {
  id: string;
  title: string;
  category: string;
  energy_level: string;
  estimated_minutes: number | null;
  deferred_count: number;
  project_id: string | null;
}

interface Project {
  id: string;
  name: string;
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`;
}

const energyDotColors: Record<string, string> = {
  low: "bg-[var(--energy-low)]",
  medium: "bg-amarillo",
  high: "bg-rojo",
};

export default async function MananaPage() {
  const user = await requireUser();
  const tomorrowDate = getTomorrowDate();

  const [rawTasks, rawProjects] = await Promise.all([
    callTool("get_unscheduled_tasks", { user_id: user.id }),
    callTool("get_projects", { user_id: user.id }),
  ]);

  const tasks: Task[] = Array.isArray(rawTasks) ? rawTasks : [];
  const projects: Project[] = Array.isArray(rawProjects) ? rawProjects : [];

  const projectsMap: Record<string, string> = {};
  for (const p of projects) {
    projectsMap[p.id] = p.name;
  }

  // Deferred tasks first, then inbox
  const deferredTasks = tasks.filter((t) => t.deferred_count > 0);
  const inboxTasks = tasks.filter((t) => t.deferred_count === 0);

  return (
    <div className="flex flex-col gap-(--space-6) animate-fade-slide-up">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-xl text-blanco italic">
          Mañana
        </h1>
        <p className="text-xs text-gris mt-1 font-[family-name:var(--font-body)]">{formatDate(tomorrowDate)}</p>
      </div>

      {/* Deferred tasks */}
      {deferredTasks.length > 0 && (
        <div className="flex flex-col gap-(--space-2)">
          <span className="text-xs text-amarillo tracking-[0.15em] uppercase font-[family-name:var(--font-body)] font-medium">
            Diferidas ({deferredTasks.length})
          </span>
          <div className="flex flex-col gap-(--space-2) stagger-children">
            {deferredTasks.map((task) => (
              <div key={task.id} className="bg-bg-card rounded-(--radius-md) p-(--space-3) flex items-center gap-(--space-3) border border-amarillo/[0.06]">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${energyDotColors[task.energy_level] ?? "bg-amarillo"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-blanco truncate">{task.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-gris">
                      {task.project_id ? projectsMap[task.project_id] : task.category}
                    </span>
                    {task.estimated_minutes && (
                      <>
                        <span className="text-gris/30">·</span>
                        <span className="text-xs text-gris/60">{task.estimated_minutes}m</span>
                      </>
                    )}
                    {task.deferred_count > 1 && (
                      <>
                        <span className="text-gris/30">·</span>
                        <span className="text-xs text-amarillo/60">{task.deferred_count}x diferida</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inbox tasks */}
      {inboxTasks.length > 0 && (
        <div className="flex flex-col gap-(--space-2)">
          <span className="text-xs text-gris tracking-[0.15em] uppercase font-[family-name:var(--font-body)] font-medium">
            En bandeja ({inboxTasks.length})
          </span>
          <div className="flex flex-col gap-(--space-2) stagger-children">
            {inboxTasks.map((task) => (
              <div key={task.id} className="bg-bg-card rounded-(--radius-md) p-(--space-3) flex items-center gap-(--space-3) border border-blanco/[0.04]">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${energyDotColors[task.energy_level] ?? "bg-gris/40"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-blanco truncate">{task.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-gris">
                      {task.project_id ? projectsMap[task.project_id] : task.category}
                    </span>
                    {task.estimated_minutes && (
                      <>
                        <span className="text-gris/30">·</span>
                        <span className="text-xs text-gris/60">{task.estimated_minutes}m</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-16rem)] gap-(--space-6)">
          <Image src="/images/icon-white.png" alt="Latido" width={64} height={64} className="opacity-30" />
          <p className="text-gris text-center text-sm font-[family-name:var(--font-body)]">
            No hay tareas pendientes para mañana.
          </p>
        </div>
      )}
    </div>
  );
}
