"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUserId } from "@/components/AuthProvider";

const TIMEZONES = [
  { value: "America/Mexico_City", label: "Ciudad de México (CST)" },
  { value: "America/Monterrey", label: "Monterrey (CST)" },
  { value: "America/Cancun", label: "Cancún (EST)" },
  { value: "America/Tijuana", label: "Tijuana (PST)" },
  { value: "America/Bogota", label: "Bogotá (COT)" },
  { value: "America/Lima", label: "Lima (PET)" },
  { value: "America/Santiago", label: "Santiago (CLT)" },
  { value: "America/Buenos_Aires", label: "Buenos Aires (ART)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "America/Los_Angeles", label: "Los Ángeles (PST)" },
  { value: "America/Denver", label: "Denver (MST)" },
  { value: "America/Chicago", label: "Chicago (CST)" },
  { value: "America/New_York", label: "Nueva York (EST)" },
];

const NOTIFICATION_CHANNELS = [
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "Email" },
  { value: "push", label: "Push" },
];

interface UserSettings {
  timezone: string;
  work_hours_start: string;
  work_hours_end: string;
  planning_time: string;
  max_daily_tasks: number | null;
  notification_channel: string;
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

const DEFAULT_SETTINGS: UserSettings = {
  timezone: "America/Mexico_City",
  work_hours_start: "09:00",
  work_hours_end: "18:00",
  planning_time: "morning",
  max_daily_tasks: null,
  notification_channel: "email",
};

export default function SettingsPage() {
  useUserId();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isOnboarding = searchParams.get("onboarding") === "1";
  const googleStatus = searchParams.get("google");
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [google, setGoogle] = useState<{ connected: boolean; email: string | null } | null>(null);

  useEffect(() => {
    fetch(`/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (!data || !data.timezone) {
          // New user — no settings yet
          setSettings(DEFAULT_SETTINGS);
          setIsNew(true);
        } else {
          setSettings({
            timezone: data.timezone,
            work_hours_start: formatTime(data.work_hours_start),
            work_hours_end: formatTime(data.work_hours_end),
            planning_time: data.planning_time,
            max_daily_tasks: data.max_daily_tasks,
            notification_channel: data.notification_channel,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch(`/api/google/status`)
      .then((res) => res.json())
      .then(setGoogle)
      .catch(() => setGoogle({ connected: false, email: null }));
  }, []);

  // Show toast based on Google connection status
  useEffect(() => {
    if (!googleStatus) return;
    if (googleStatus === "connected") {
      setToast("Google Calendar conectado");
    } else {
      setToast("No se pudo conectar Google Calendar");
    }
    setTimeout(() => setToast(null), 3000);
  }, [googleStatus]);

  async function handleDisconnectGoogle() {
    if (!window.confirm("¿Desconectar Google Calendar?")) return;
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      setGoogle({ connected: false, email: null });
      setToast("Google Calendar desconectado");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Error al desconectar");
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        if (isOnboarding || isNew) {
          router.push("/hoy");
          return;
        }
        setToast("Configuración guardada");
        setTimeout(() => setToast(null), 2500);
      } else {
        setToast("Error al guardar");
        setTimeout(() => setToast(null), 2500);
      }
    } catch {
      setToast("Error al guardar");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-azul border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-20 text-gris font-[family-name:var(--font-body)]">
        No se pudieron cargar los ajustes.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-(--space-6) py-(--space-4) animate-fade-slide-up">
      {(isOnboarding || isNew) && (
        <div className="bg-azul/10 border border-azul/20 rounded-(--radius-lg) p-(--space-4) text-center">
          <p className="text-blanco text-sm font-[family-name:var(--font-heading)] italic">
            Bienvenida a Latido
          </p>
          <p className="text-gris text-xs mt-1 font-[family-name:var(--font-body)]">
            Antes de empezar, configura tu horario de trabajo.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-heading)] text-xl text-blanco italic">
          Ajustes
        </h1>
        {!isOnboarding && !isNew && (
          <Link
            href="/proyectos"
            className="text-xs text-azul font-[family-name:var(--font-body)] font-medium hover:text-azul-light transition-colors"
          >
            Proyectos
          </Link>
        )}
      </div>

      {/* Timezone */}
      <SettingsSection label="Zona horaria">
        <select
          value={settings.timezone}
          onChange={(e) => updateField("timezone", e.target.value)}
          className="w-full bg-bg-card text-blanco border border-blanco/[0.06] rounded-(--radius-md) px-(--space-3) py-(--space-3) text-sm font-[family-name:var(--font-body)] focus:outline-none focus:border-azul/50 transition-colors"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </SettingsSection>

      {/* Work hours */}
      <SettingsSection label="Horario de trabajo">
        <div className="flex items-center gap-(--space-3)">
          <TimeInput
            value={settings.work_hours_start}
            onChange={(v) => updateField("work_hours_start", v)}
          />
          <span className="text-gris/50 text-sm">a</span>
          <TimeInput
            value={settings.work_hours_end}
            onChange={(v) => updateField("work_hours_end", v)}
          />
        </div>
      </SettingsSection>

      {/* Planning time */}
      <SettingsSection label="¿Cuándo planificas tu día?">
        <div className="flex gap-(--space-2)">
          <TogglePill
            label="Mañana"
            active={settings.planning_time === "morning"}
            onTap={() => updateField("planning_time", "morning")}
          />
          <TogglePill
            label="Noche"
            active={settings.planning_time === "evening"}
            onTap={() => updateField("planning_time", "evening")}
          />
        </div>
      </SettingsSection>

      {/* Max daily tasks */}
      <SettingsSection label="Máximo de tareas por día">
        <div className="flex items-center gap-(--space-3)">
          <input
            type="number"
            min={1}
            max={20}
            value={settings.max_daily_tasks ?? ""}
            placeholder="Sin límite"
            onChange={(e) => {
              const val = e.target.value;
              updateField("max_daily_tasks", val === "" ? null : parseInt(val, 10));
            }}
            className="w-28 bg-bg-card text-blanco border border-blanco/[0.06] rounded-(--radius-md) px-(--space-3) py-(--space-3) text-sm font-[family-name:var(--font-body)] focus:outline-none focus:border-azul/50 transition-colors"
          />
          <span className="text-gris/50 text-xs font-[family-name:var(--font-body)]">
            {settings.max_daily_tasks === null ? "Sin límite" : `${settings.max_daily_tasks} tareas`}
          </span>
        </div>
      </SettingsSection>

      {/* Notification channel */}
      <SettingsSection label="Canal de notificaciones">
        <div className="flex gap-(--space-2)">
          {NOTIFICATION_CHANNELS.map((ch) => (
            <TogglePill
              key={ch.value}
              label={ch.label}
              active={settings.notification_channel === ch.value}
              onTap={() => updateField("notification_channel", ch.value)}
            />
          ))}
        </div>
      </SettingsSection>

      {/* Google Calendar */}
      {!isOnboarding && !isNew && google && (
        <SettingsSection label="Integraciones">
          <div className="bg-bg-card rounded-(--radius-md) p-(--space-4) border border-blanco/[0.06] flex items-center justify-between gap-(--space-3)">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-sm text-blanco font-[family-name:var(--font-body)] font-medium">
                Google Calendar
              </span>
              {google.connected ? (
                <span className="text-xs text-verde font-[family-name:var(--font-body)] truncate">
                  Conectado · {google.email}
                </span>
              ) : (
                <span className="text-xs text-gris/60 font-[family-name:var(--font-body)]">
                  Latido podrá leer tu calendario para planificar mejor.
                </span>
              )}
            </div>
            {google.connected ? (
              <button
                onClick={handleDisconnectGoogle}
                className="text-xs text-rojo font-[family-name:var(--font-body)] font-medium px-(--space-3) py-(--space-2) rounded-(--radius-md) bg-rojo/10 active:bg-rojo/15 transition-colors flex-shrink-0"
              >
                Desconectar
              </button>
            ) : (
              <a
                href="/api/google/connect"
                className="text-xs text-azul font-[family-name:var(--font-body)] font-medium px-(--space-3) py-(--space-2) rounded-(--radius-md) bg-azul/10 active:bg-azul/15 transition-colors flex-shrink-0"
              >
                Conectar
              </a>
            )}
          </div>
        </SettingsSection>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-azul text-bg-primary font-[family-name:var(--font-body)] font-semibold text-sm py-(--space-3) rounded-(--radius-md) active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_4px_16px_rgba(59,143,228,0.25)]"
      >
        {saving ? "Guardando..." : (isOnboarding || isNew) ? "Empezar a usar Latido" : "Guardar cambios"}
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 glass text-blanco text-sm px-(--space-4) py-(--space-3) rounded-(--radius-md) shadow-lg z-50 animate-fade-in border border-blanco/5 font-[family-name:var(--font-body)]">
          {toast}
        </div>
      )}
    </div>
  );
}

function SettingsSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-(--space-2)">
      <label className="text-sm text-gris font-[family-name:var(--font-body)] font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-bg-card text-blanco border border-blanco/[0.06] rounded-(--radius-md) px-(--space-3) py-(--space-3) text-sm font-[family-name:var(--font-body)] focus:outline-none focus:border-azul/50 transition-colors"
    />
  );
}

function TogglePill({ label, active, onTap }: { label: string; active: boolean; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className={`
        px-(--space-4) py-(--space-2) rounded-full text-sm
        font-[family-name:var(--font-body)] font-medium transition-all
        ${active
          ? "bg-azul text-bg-primary shadow-[0_2px_12px_rgba(59,143,228,0.2)]"
          : "bg-bg-card text-gris border border-blanco/[0.06] hover:border-blanco/10"
        }
      `}
    >
      {label}
    </button>
  );
}
