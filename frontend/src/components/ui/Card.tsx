interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "tile" | "elevated";
  className?: string;
}

export function Card({ children, variant = "default", className = "" }: CardProps) {
  const base = "rounded-(--radius-lg) p-(--space-4) border border-blanco/[0.04]";

  const variants = {
    default: "bg-bg-card",
    tile: "bg-bg-card talavera-border-top",
    elevated: "bg-bg-card-elevated shadow-(--shadow-md)",
  };

  return (
    <div className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
