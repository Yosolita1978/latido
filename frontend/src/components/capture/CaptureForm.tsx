"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { TEMP_USER_ID } from "@/lib/constants";

interface Project {
  id: string;
  name: string;
}

interface CaptureFormProps {
  projects: Project[];
}

export function CaptureForm({ projects }: CaptureFormProps) {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  async function handleSubmit() {
    const text = selectedProject
      ? `${rawText} (proyecto: ${projects.find((p) => p.id === selectedProject)?.name})`
      : rawText;

    if (!text.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/agents/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: TEMP_USER_ID, raw_text: text }),
      });

      if (!response.ok) throw new Error(`Error ${response.status}`);

      const data = await response.json();

      if (data.action === "create_new") {
        setToast({ message: `Tarea capturada: "${data.title}"`, type: "success" });
      } else {
        setToast({ message: `Tarea existente encontrada: "${data.title}"`, type: "success" });
      }

      setRawText("");
      setSelectedProject(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setToast({ message: `No se pudo capturar: ${message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)] h-full">
      <Input
        placeholder="Escribe lo que necesitas hacer..."
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        disabled={loading}
      />

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

      <div className="mt-auto">
        <Button
          onClick={handleSubmit}
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
          ) : (
            "Capturar"
          )}
        </Button>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
