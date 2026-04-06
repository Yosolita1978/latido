"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Toast } from "@/components/ui/Toast";

interface Project {
  id: string;
  name: string;
}

interface SearchMatch {
  id: string;
  title: string;
  combined_score: number;
}

interface CaptureSheetProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
}

const placeholders = [
  "Terminar el diseño de Latido...",
  "Responder a Juan Pablo sobre el contrato...",
  "Comprar leche...",
  "Esa cosa que no terminé de MujerTech...",
  "Revisar el PR de inventario de Nouvie...",
  "Enviar factura a Mario...",
  "Preparar la presentación del viernes...",
];

const energyOptions = [
  { level: "low", icon: "〰", label: "Baja", activeClass: "bg-[var(--energy-low)]/15 text-[var(--energy-low)] border-[var(--energy-low)]/30" },
  { level: "medium", icon: "〜", label: "Media", activeClass: "bg-amarillo/15 text-amarillo border-amarillo/30" },
  { level: "high", icon: "⚡", label: "Alta", activeClass: "bg-rojo/15 text-rojo border-rojo/30" },
];

const timeOptions = [
  { minutes: 15, label: "15m" },
  { minutes: 30, label: "30m" },
  { minutes: 45, label: "45m" },
  { minutes: 60, label: "1h" },
  { minutes: 120, label: "2h" },
];

const priorityOptions = [
  { level: "low", label: "Puede esperar", activeClass: "bg-gris/15 text-gris border-gris/30" },
  { level: "medium", label: "Normal", activeClass: "bg-azul/15 text-azul border-azul/30" },
  { level: "high", label: "Urgente", activeClass: "bg-rojo/15 text-rojo border-rojo/30" },
];

export function CaptureSheet({ open, onClose, projects }: CaptureSheetProps) {
  const [rawText, setRawText] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [placeholder, setPlaceholder] = useState(placeholders[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Rotate placeholder
  useEffect(() => {
    if (!open) return;
    setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]);
  }, [open]);

  // Auto-focus when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    } else {
      setRawText("");
      setSelectedProject(null);
      setSelectedEnergy(null);
      setSelectedTime(null);
      setSelectedPriority(null);
      setMatches([]);
    }
  }, [open]);

  // Debounced hybrid search
  const handleTextChange = useCallback((text: string) => {
    setRawText(text);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (text.trim().length < 3) {
      setMatches([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text }),
        });
        if (response.ok) {
          const results = await response.json();
          setMatches(results);
        }
      } catch {
        // Silent fail — search preview is optional
      }
    }, 500);
  }, []);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "56px";
      textareaRef.current.style.height = Math.max(56, textareaRef.current.scrollHeight) + "px";
    }
  }, [rawText]);

  async function handleMatchTap(matchId: string, matchTitle: string) {
    setLoading(true);
    try {
      await fetch("/api/tasks/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: matchId, status: "inbox" }),
      });
      onClose();
      setToast({ message: `${matchTitle}`, type: "success" });
    } catch {
      setToast({ message: "No se pudo vincular la tarea", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!rawText.trim() || loading) return;

    let text = rawText;
    if (selectedProject) {
      const projName = projects.find((p) => p.id === selectedProject)?.name;
      if (projName) text += ` (proyecto: ${projName})`;
    }
    if (selectedEnergy) text += ` [energy: ${selectedEnergy}]`;
    if (selectedTime) text += ` [estimated: ${selectedTime}min]`;
    if (selectedPriority) text += ` [priority: ${selectedPriority}]`;

    setLoading(true);
    try {
      const response = await fetch("/api/agents/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: text,
          capture_mode: "tarea",
        }),
      });

      if (!response.ok) throw new Error(`Error ${response.status}`);

      const data = await response.json();
      onClose();
      setToast({ message: data.title, type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setToast({ message: `No se pudo capturar: ${message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sheet */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50
          bg-bg-surface/95 backdrop-blur-xl rounded-t-[28px]
          border-t border-blanco/5
          transition-transform duration-300 ease-out
          ${open ? "translate-y-0" : "translate-y-full"}
        `}
        style={{ maxHeight: "85vh" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-blanco/15" />
        </div>

        <div className="flex flex-col px-(--space-4) pb-(--space-4) overflow-y-auto" style={{ maxHeight: "calc(85vh - 20px)" }}>
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            disabled={loading}
            className="w-full min-h-[56px] max-h-[120px] p-(--space-3) bg-bg-card text-blanco text-base rounded-(--radius-lg) border border-blanco/[0.06] focus:border-azul/50 focus:outline-none placeholder:text-gris/40 font-[family-name:var(--font-body)] resize-none transition-colors"
          />

          {/* Project chips — horizontal scroll */}
          {projects.length > 0 && (
            <div className="flex gap-(--space-2) overflow-x-auto py-(--space-3) scrollbar-hide">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() =>
                    setSelectedProject(selectedProject === project.id ? null : project.id)
                  }
                  disabled={loading}
                  className={`
                    whitespace-nowrap px-(--space-3) py-1.5 rounded-full text-xs font-medium
                    font-[family-name:var(--font-body)] transition-all flex-shrink-0
                    ${
                      selectedProject === project.id
                        ? "bg-azul text-bg-primary"
                        : "bg-bg-card text-gris border border-blanco/[0.06] active:border-blanco/15"
                    }
                  `}
                >
                  {project.name}
                </button>
              ))}
            </div>
          )}

          {/* Search match preview */}
          {matches.length > 0 && (
            <button
              onClick={() => handleMatchTap(matches[0].id, matches[0].title)}
              disabled={loading}
              className="w-full bg-bg-card-elevated rounded-(--radius-md) p-(--space-3) flex items-center gap-(--space-3) mb-(--space-3) text-left border border-azul/10 transition-all active:border-azul/25"
            >
              <span className="text-azul text-xs flex-shrink-0">¿Es esta tarea?</span>
              <span className="text-sm text-blanco truncate">{matches[0].title}</span>
            </button>
          )}

          {/* Options — always visible */}
          <div className="flex flex-col gap-(--space-4) py-(--space-3)">
            {/* Priority */}
            <OptionRow label="Prioridad">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.level}
                  onClick={() => setSelectedPriority(selectedPriority === opt.level ? null : opt.level)}
                  disabled={loading}
                  className={`
                    px-(--space-3) py-1.5 rounded-full text-xs font-medium
                    font-[family-name:var(--font-body)] transition-all
                    ${selectedPriority === opt.level
                      ? opt.activeClass + " border-2"
                      : "bg-bg-card text-gris border border-blanco/[0.06]"
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </OptionRow>

            {/* Energy */}
            <OptionRow label="Energía que requiere">
              {energyOptions.map((opt) => (
                <button
                  key={opt.level}
                  onClick={() => setSelectedEnergy(selectedEnergy === opt.level ? null : opt.level)}
                  disabled={loading}
                  className={`
                    flex items-center gap-1.5 px-(--space-3) py-1.5 rounded-full text-xs font-medium
                    font-[family-name:var(--font-body)] transition-all
                    ${selectedEnergy === opt.level
                      ? opt.activeClass + " border-2"
                      : "bg-bg-card text-gris border border-blanco/[0.06]"
                    }
                  `}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </OptionRow>

            {/* Time */}
            <OptionRow label="Tiempo estimado">
              {timeOptions.map((opt) => (
                <button
                  key={opt.minutes}
                  onClick={() => setSelectedTime(selectedTime === opt.minutes ? null : opt.minutes)}
                  disabled={loading}
                  className={`
                    px-(--space-3) py-1.5 rounded-full text-xs font-medium
                    font-[family-name:var(--font-body)] transition-all
                    ${selectedTime === opt.minutes
                      ? "bg-azul/15 text-azul border-2 border-azul/30"
                      : "bg-bg-card text-gris border border-blanco/[0.06]"
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </OptionRow>
          </div>

          {/* Spacer */}
          <div className="flex-1 min-h-[var(--space-4)]" />

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={loading || rawText.trim().length === 0}
            className={`
              w-full min-h-[48px] rounded-(--radius-md)
              font-[family-name:var(--font-body)] font-semibold text-base
              transition-all duration-200
              disabled:opacity-30 disabled:cursor-not-allowed
              ${loading
                ? "bg-azul/60 text-bg-primary animate-pulse"
                : "bg-azul text-bg-primary active:scale-[0.98] shadow-[0_4px_16px_rgba(59,143,228,0.25)]"
              }
            `}
          >
            {loading ? "Capturando..." : "Capturar"}
          </button>
        </div>
      </div>

      {/* Toast — renders outside sheet so it shows after sheet closes */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-(--space-2)">
      <span className="text-xs text-gris/70 font-[family-name:var(--font-body)]">
        {label}
      </span>
      <div className="flex gap-(--space-2) flex-wrap">
        {children}
      </div>
    </div>
  );
}
