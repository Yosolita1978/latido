const categoryColors: Record<string, string> = {
  admin: "bg-gris/20 text-gris",
  client_work: "bg-azul-light/20 text-azul",
  deep_work: "bg-rojo/10 text-rojo",
  learning: "bg-amarillo/20 text-negro",
  personal: "bg-verde/20 text-verde",
  maintenance: "bg-terracotta/20 text-terracotta",
};

interface BadgeProps {
  label: string;
  category?: string;
  className?: string;
}

export function Badge({ label, category, className = "" }: BadgeProps) {
  const colors = category ? (categoryColors[category] ?? "bg-gris/20 text-gris") : "bg-gris/20 text-gris";

  return (
    <span
      className={`
        inline-flex items-center px-[var(--space-2)] py-0.5
        rounded-full text-xs font-medium
        font-[family-name:var(--font-body)]
        ${colors} ${className}
      `}
    >
      {label}
    </span>
  );
}
