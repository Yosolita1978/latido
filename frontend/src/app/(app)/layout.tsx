import Image from "next/image";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AuthProvider } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();

  return (
    <AuthProvider userId={user.id}>
      <div className="flex flex-col min-h-full pb-16">
        {/* Header */}
        <header className="flex items-center justify-between px-(--space-4) py-(--space-3) sticky top-0 z-40 glass border-b border-blanco/5">
          <div className="w-8" />
          <Link href="/hoy" className="flex items-center gap-(--space-2) group">
            <Image
              src="/images/icon-white.png"
              alt="Latido"
              width={32}
              height={32}
              className="opacity-90 group-hover:opacity-100 transition-opacity"
            />
            <span className="font-[family-name:var(--font-heading)] text-lg text-blanco tracking-wide">
              Latido
            </span>
          </Link>
          <Link
            href="/settings"
            className="text-gris hover:text-blanco transition-colors p-1"
            aria-label="Ajustes"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </header>

        <AppShell>
          {children}
        </AppShell>
      </div>
    </AuthProvider>
  );
}
