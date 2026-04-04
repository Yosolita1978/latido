"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Toast } from "@/components/ui/Toast";
import { TEMP_USER_ID } from "@/lib/constants";

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

export function CaptureSheet({ open, onClose, projects }: CaptureSheetProps) {
  const [rawText, setRawText] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
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
      setShowOptions(false);
      setSelectedEnergy(null);
      setSelectedTime(null);
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
          body: JSON.stringify({ user_id: TEMP_USER_ID, query: text }),
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
      textareaRef.current.style.height = "80px";
      textareaRef.current.style.height = Math.max(80, textareaRef.current.scrollHeight) + "px";
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

    setLoading(true);
    try {
      const response = await fetch("/api/agents/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: TEMP_USER_ID,
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
        style={{ height: "60vh", maxHeight: "600px" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-blanco/15" />
        </div>

        <div className="flex flex-col h-[calc(100%-20px)] px-(--space-4) pb-(--space-4)">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            disabled={loading}
            className="w-full min-h-[80px] max-h-[160px] p-(--space-4) bg-bg-card text-blanco text-base rounded-(--radius-lg) border border-blanco/[0.06] focus:border-azul/50 focus:outline-none placeholder:text-gris/40 font-[family-name:var(--font-body)] resize-none transition-colors"
          />

          {/* Project chips — horizontal scroll */}
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

          {/* More options toggle */}
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="text-xs text-gris/50 text-left py-1 font-[family-name:var(--font-body)] transition-colors hover:text-gris/80"
          >
            {showOptions ? "menos opciones" : "más opciones"}
          </button>

          {showOptions && (
            <div className="flex items-center gap-(--space-2) py-(--space-2) animate-fade-in">
              {/* Energy icons */}
              {energyOptions.map((opt) => (
                <button
                  key={opt.level}
                  onClick={() => setSelectedEnergy(selectedEnergy === opt.level ? null : opt.level)}
                  className={`
                    min-w-[48px] min-h-[48px] rounded-(--radius-md) text-sm
                    flex items-center justify-center border-2 transition-all
                    ${selectedEnergy === opt.level
                      ? opt.activeClass
                      : "bg-bg-card text-gris border-blanco/[0.06]"
                    }
                  `}
                  aria-label={`Energía ${opt.label}`}
                >
                  {opt.icon}
                </button>
              ))}
              <div className="w-px h-6 bg-blanco/[0.06]" />
              {/* Time pills */}
              {timeOptions.map((opt) => (
                <button
                  key={opt.minutes}
                  onClick={() => setSelectedTime(selectedTime === opt.minutes ? null : opt.minutes)}
                  className={`
                    min-h-[48px] px-2.5 rounded-(--radius-md) text-xs font-medium transition-all
                    ${selectedTime === opt.minutes
                      ? "bg-azul text-bg-primary"
                      : "bg-bg-card text-gris border border-blanco/[0.06]"
                    }
                  `}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={loading || !rawText.trim()}
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
