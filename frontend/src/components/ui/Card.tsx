interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "tile" | "elevated";
  className?: string;
}

export function Card({ children, variant = "default", className = "" }: CardProps) {
  const base = "rounded-[var(--radius-lg)] p-[var(--space-4)]";

  const variants = {
    default: "bg-bg-card",
    tile: "bg-bg-card talavera-border-top",
    elevated: "bg-bg-card-elevated shadow-[var(--shadow-md)]",
  };

  return (
    <div className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
