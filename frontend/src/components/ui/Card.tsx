interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "tile";
  className?: string;
}

export function Card({ children, variant = "default", className = "" }: CardProps) {
  return (
    <div
      className={`
        bg-blanco rounded-[var(--radius-md)] shadow-[var(--shadow-md)] p-[var(--space-4)]
        ${variant === "tile" ? "talavera-border-top" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
