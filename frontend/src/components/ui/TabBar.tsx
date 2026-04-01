"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/capturar", label: "Capturar", icon: "+" },
  { href: "/hoy", label: "Hoy", icon: "◉" },
  { href: "/reflexion", label: "Reflexión", icon: "◐" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-blanco border-t border-gris/20 flex items-center justify-around z-50">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`
              flex flex-col items-center gap-0.5 min-w-[64px] py-[var(--space-2)]
              text-xs font-[family-name:var(--font-body)]
              transition-colors duration-150
              ${active ? "text-azul" : "text-gris"}
            `}
          >
            <span className="text-xl">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
