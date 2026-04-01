import { TabBar } from "@/components/ui/TabBar";

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
          <span className="text-verde text-lg">♥</span>
          <span className="font-[family-name:var(--font-heading)] text-lg text-blanco">
            Latido
          </span>
        </div>
        <button className="w-8 h-8 flex items-center justify-center text-gris">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
            <circle cx="9" cy="3" r="1.5" />
            <circle cx="9" cy="9" r="1.5" />
            <circle cx="9" cy="15" r="1.5" />
          </svg>
        </button>
      </header>

      <main className="flex-1 px-[var(--space-4)] pb-[var(--space-4)] max-w-lg mx-auto w-full">
        {children}
      </main>
      <TabBar />
    </div>
  );
}
