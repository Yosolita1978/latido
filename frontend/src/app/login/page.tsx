"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase-browser";

function LoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-[var(--space-4)]">
      <div className="w-full max-w-sm flex flex-col items-center gap-[var(--space-8)]">
        <div className="flex flex-col items-center gap-[var(--space-4)]">
          <Image
            src="/images/icon-white.png"
            alt="Latido"
            width={64}
            height={64}
            className="opacity-80"
            priority
          />
          <h1 className="font-[family-name:var(--font-heading)] text-2xl text-blanco italic">
            Latido
          </h1>
          <p className="text-sm text-gris text-center font-[family-name:var(--font-body)]">
            Tu planner diario con inteligencia artificial
          </p>
        </div>

        {sent ? (
          <div className="w-full bg-bg-card rounded-[var(--radius-lg)] p-[var(--space-6)] text-center border border-azul/10">
            <p className="text-blanco font-[family-name:var(--font-body)] text-sm">
              Revisa tu correo
            </p>
            <p className="text-gris text-xs mt-2 font-[family-name:var(--font-body)]">
              Enviamos un enlace mágico a <span className="text-azul">{email}</span>
            </p>
            <button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="mt-4 text-xs text-gris/60 hover:text-gris transition-colors font-[family-name:var(--font-body)]"
            >
              Usar otro correo
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-[var(--space-4)]">
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full p-[var(--space-4)] bg-bg-card text-blanco text-base rounded-[var(--radius-lg)] border border-blanco/[0.06] focus:border-azul/50 focus:outline-none placeholder:text-gris/40 font-[family-name:var(--font-body)] transition-colors"
            />

            {error && (
              <p className="text-rojo text-xs font-[family-name:var(--font-body)]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || email.trim().length === 0}
              className="w-full bg-azul text-bg-primary font-[family-name:var(--font-body)] font-semibold text-base py-[var(--space-4)] rounded-[var(--radius-lg)] active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_4px_16px_rgba(59,143,228,0.25)]"
            >
              {loading ? "Enviando..." : "Enviar enlace mágico"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
