import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-full pb-16">
      {/* Header */}
      <header className="flex items-center justify-between px-[var(--space-4)] py-[var(--space-3)] sticky top-0 z-40 bg-bg-primary/90 backdrop-blur-sm">
        <div className="w-8" />
        <div className="flex items-center gap-[var(--space-2)]">
          <Image src="/images/icon.png" alt="Latido" width={36} height={36} />
          <span className="font-[family-name:var(--font-heading)] text-lg text-blanco">
            Latido
          </span>
        </div>
        <Link
          href="/proyectos"
          className="text-xs text-gris hover:text-blanco transition-colors font-[family-name:var(--font-body)]"
        >
          Proyectos
        </Link>
      </header>

      <AppShell>
        {children}
      </AppShell>
    </div>
  );
}
