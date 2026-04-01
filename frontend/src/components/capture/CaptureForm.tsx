"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { TEMP_USER_ID } from "@/lib/constants";

type CaptureMode = "tarea" | "actividad" | "energia";

interface Project {
  id: string;
  name: string;
}

interface CaptureFormProps {
  projects: Project[];
}

const modes: { key: CaptureMode; label: string; icon: string }[] = [
  { key: "tarea", label: "Tarea", icon: "✓" },
  { key: "actividad", label: "Actividad", icon: "◎" },
  { key: "energia", label: "Energía", icon: "⚡" },
];

const energyOptions = [
  { level: "low", label: "Baja", emoji: "🌙", color: "bg-azul-light/20 border-azul-light/40 text-azul-light" },
  { level: "medium", label: "Media", emoji: "⚡", color: "bg-amarillo/20 border-amarillo/40 text-amarillo" },
  { level: "high", label: "Alta", emoji: "🔥", color: "bg-rojo/20 border-rojo/40 text-rojo" },
];

const placeholders: Record<CaptureMode, string> = {
  tarea: "Escribe lo que necesitas hacer...",
  actividad: "¿Qué actividad? ej: pilates a las 4, terapia a las 10...",
  energia: "",
};

const toastMessages: Record<string, Record<string, string>> = {
  tarea: {
    create_new: "Tarea capturada",
    reference_existing: "Tarea existente encontrada",
  },
  actividad: {
    create_new: "Actividad registrada",
    reference_existing: "Actividad existente encontrada",
  },
  energia: {
    energy_logged: "Energía registrada",
  },
};

export function CaptureForm({ projects }: CaptureFormProps) {
  const [mode, setMode] = useState<CaptureMode>("tarea");
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  async function handleSubmit(overrideText?: string) {
    const text = overrideText ?? (
      selectedProject
        ? `${rawText} (proyecto: ${projects.find((p) => p.id === selectedProject)?.name})`
        : rawText
    );

    if (!text.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/agents/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: TEMP_USER_ID,
          raw_text: text,
          capture_mode: mode,
        }),
      });

      if (!response.ok) throw new Error(`Error ${response.status}`);

      const data = await response.json();
      const msgGroup = toastMessages[data.type] ?? toastMessages.tarea;
      const prefix = msgGroup[data.action] ?? "Capturado";

      setToast({ message: `${prefix}: "${data.title}"`, type: "success" });
      setRawText("");
      setSelectedProject(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setToast({ message: `No se pudo capturar: ${message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleEnergySelect(level: string) {
    setLoading(true);
    try {
      const response = await fetch("/api/energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: TEMP_USER_ID, energy_level: level }),
      });

      if (!response.ok) throw new Error(`Error ${response.status}`);

      const label = energyOptions.find((o) => o.level === level)?.label ?? level;
      setToast({ message: `Energía registrada: ${label}`, type: "success" });
    } catch {
      setToast({ message: "No se pudo registrar la energía", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)] h-full">
      {/* Mode selector */}
      <div className="flex gap-[var(--space-2)]">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setRawText(""); setSelectedProject(null); }}
            className={`
              flex-1 py-[var(--space-3)] rounded-[var(--radius-md)] text-sm font-medium
              font-[family-name:var(--font-body)] transition-all duration-150
              ${mode === m.key
                ? "bg-azul text-bg-primary"
                : "bg-bg-card text-gris border border-blanco/10"
              }
            `}
          >
            <span className="mr-1">{m.icon}</span> {m.label}
          </button>
        ))}
      </div>

      {/* Energy mode */}
      {mode === "energia" && (
        <div className="flex flex-col gap-[var(--space-4)] flex-1 justify-center">
          <p className="text-center text-gris text-sm">¿Cómo te sientes hoy?</p>
          <div className="flex flex-col gap-[var(--space-3)]">
            {energyOptions.map((option) => (
              <button
                key={option.level}
                onClick={() => handleEnergySelect(option.level)}
                disabled={loading}
                className={`
                  w-full py-[var(--space-5)] rounded-[var(--radius-lg)]
                  text-lg font-medium border-2 transition-all duration-150
                  disabled:opacity-50
                  ${option.color}
                `}
              >
                {option.emoji} {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Task / Activity mode */}
      {mode !== "energia" && (
        <>
          <div>
            <Input
              placeholder={placeholders[mode]}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gris/50 mt-[var(--space-2)]">
              Captura una {mode === "tarea" ? "tarea" : "actividad"} a la vez.
            </p>
          </div>

          {/* Project chips (only for tarea mode) */}
          {mode === "tarea" && (
            <div className="flex flex-wrap gap-[var(--space-2)]">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() =>
                    setSelectedProject(selectedProject === project.id ? null : project.id)
                  }
                  disabled={loading}
                  className={`
                    px-[var(--space-3)] py-[var(--space-1)] rounded-full text-sm
                    font-[family-name:var(--font-body)] transition-colors duration-150
                    ${
                      selectedProject === project.id
                        ? "bg-azul text-bg-primary"
                        : "bg-bg-card text-gris border border-blanco/10 hover:border-azul hover:text-azul"
                    }
                  `}
                >
                  {project.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-auto">
            <Button
              onClick={() => handleSubmit()}
              disabled={loading || !rawText.trim()}
              className="w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-[var(--space-2)]">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Procesando...
                </span>
              ) : mode === "actividad" ? (
                "Registrar actividad"
              ) : (
                "Capturar"
              )}
            </Button>
          </div>
        </>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
