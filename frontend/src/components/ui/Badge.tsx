const categoryColors: Record<string, string> = {
  admin: "bg-gris/15 text-gris border-gris/10",
  client_work: "bg-azul/15 text-azul-light border-azul/10",
  deep_work: "bg-rojo/15 text-rojo border-rojo/10",
  learning: "bg-amarillo/15 text-amarillo border-amarillo/10",
  personal: "bg-verde/15 text-verde border-verde/10",
  maintenance: "bg-terracotta/15 text-terracotta border-terracotta/10",
};

interface BadgeProps {
  label: string;
  category?: string;
  className?: string;
}

export function Badge({ label, category, className = "" }: BadgeProps) {
  const colors = category ? (categoryColors[category] ?? "bg-gris/15 text-gris border-gris/10") : "";

  return (
    <span
      className={`
        inline-flex items-center px-(--space-3) py-1
        rounded-full text-xs font-medium border
        font-[family-name:var(--font-body)]
        ${colors} ${className}
      `}
    >
      {label}
    </span>
  );
}
