import { TabBar } from "@/components/ui/TabBar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-col min-h-full pb-16">
      <main className="flex-1 px-[var(--space-4)] py-[var(--space-4)] max-w-lg mx-auto w-full">
        {children}
      </main>
      <TabBar />
    </div>
  );
}
