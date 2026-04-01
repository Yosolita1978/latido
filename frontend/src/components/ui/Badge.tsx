const categoryColors: Record<string, string> = {
  admin: "bg-gris/20 text-gris",
  client_work: "bg-azul/20 text-azul-light",
  deep_work: "bg-rojo/20 text-rojo",
  learning: "bg-amarillo/20 text-amarillo",
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
        inline-flex items-center px-[var(--space-3)] py-1
        rounded-full text-xs font-medium
        font-[family-name:var(--font-body)]
        ${colors} ${className}
      `}
    >
      {label}
    </span>
  );
}
