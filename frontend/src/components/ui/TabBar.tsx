"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/hoy",
    label: "Hoy",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    href: "/manana",
    label: "Mañana",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/reflexion/patrones",
    label: "Patrones",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
] as const;

interface TabBarProps {
  onCaptureTap: () => void;
}

export function TabBar({ onCaptureTap }: TabBarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* FAB - Capture button */}
      <button
        onClick={onCaptureTap}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-amarillo flex items-center justify-center active:scale-90 transition-all duration-200 hover:shadow-[0_0_24px_rgba(242,201,76,0.3)]"
        style={{ boxShadow: "0 4px 20px rgba(242, 201, 76, 0.25)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--talavera-bg-primary)" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 glass border-t border-blanco/5 flex items-center justify-around z-40">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                flex flex-col items-center gap-0.5 min-w-[64px] py-(--space-2)
                text-xs font-[family-name:var(--font-body)] font-medium
                transition-all duration-200
                ${active ? "text-azul" : "text-gris hover:text-blanco/70"}
              `}
            >
              <div className={`transition-transform duration-200 ${active ? "scale-110" : ""}`}>
                {tab.icon}
              </div>
              <span>{tab.label}</span>
              {active && (
                <div className="w-1 h-1 rounded-full bg-azul mt-0.5" />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
