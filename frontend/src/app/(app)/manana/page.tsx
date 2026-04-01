import Image from "next/image";
import { callTool } from "@/lib/mcp-client";
import { TEMP_USER_ID } from "@/lib/constants";

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

export default async function MananaPage() {
  const tomorrowDate = getTomorrowDate();

  const [tasks, projects] = await Promise.all([
    callTool("get_unscheduled_tasks", { user_id: TEMP_USER_ID }) as Promise<Task[]>,
    callTool("get_projects", { user_id: TEMP_USER_ID }) as Promise<Project[]>,
  ]);

  const projectsMap: Record<string, string> = {};
  for (const p of projects) {
    projectsMap[p.id] = p.name;
  }

  // Deferred tasks first, then inbox
  const deferredTasks = tasks.filter((t) => t.deferred_count > 0);
  const inboxTasks = tasks.filter((t) => t.deferred_count === 0);

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-xl text-blanco">
          Mañana
        </h1>
        <p className="text-xs text-gris mt-1">{formatDate(tomorrowDate)}</p>
      </div>

      {/* Deferred tasks */}
      {deferredTasks.length > 0 && (
        <div className="flex flex-col gap-[var(--space-2)]">
          <span className="text-xs text-amarillo tracking-widest uppercase">
            Diferidas ({deferredTasks.length})
          </span>
          <div className="flex flex-col gap-[var(--space-2)]">
            {deferredTasks.map((task) => (
              <div key={task.id} className="bg-bg-card rounded-[var(--radius-md)] p-[var(--space-3)] flex items-center gap-[var(--space-3)]">
                <div className="w-2 h-2 rounded-full bg-amarillo flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-blanco truncate">{task.title}</p>
                  <p className="text-xs text-gris">
                    {task.project_id ? projectsMap[task.project_id] : task.category}
                    {task.estimated_minutes ? ` · ${task.estimated_minutes}min` : ""}
                    {task.deferred_count > 1 ? ` · diferida ${task.deferred_count}x` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inbox tasks */}
      {inboxTasks.length > 0 && (
        <div className="flex flex-col gap-[var(--space-2)]">
          <span className="text-xs text-gris tracking-widest uppercase">
            En bandeja ({inboxTasks.length})
          </span>
          <div className="flex flex-col gap-[var(--space-2)]">
            {inboxTasks.map((task) => (
              <div key={task.id} className="bg-bg-card rounded-[var(--radius-md)] p-[var(--space-3)] flex items-center gap-[var(--space-3)]">
                <div className="w-2 h-2 rounded-full bg-gris/40 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-blanco truncate">{task.title}</p>
                  <p className="text-xs text-gris">
                    {task.project_id ? projectsMap[task.project_id] : task.category}
                    {task.estimated_minutes ? ` · ${task.estimated_minutes}min` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-16rem)] gap-[var(--space-6)]">
          <Image src="/images/logo.png" alt="Latido" width={180} height={65} className="opacity-50" />
          <p className="text-gris text-center text-sm">No hay tareas pendientes para mañana.</p>
        </div>
      )}
    </div>
  );
}
