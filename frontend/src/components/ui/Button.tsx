"use client";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  children: React.ReactNode;
}

const variantStyles = {
  primary: "bg-azul text-bg-primary hover:bg-azul-light active:scale-[0.98] shadow-[0_4px_16px_rgba(59,143,228,0.25)]",
  secondary: "bg-terracotta text-blanco hover:opacity-90 active:scale-[0.98] shadow-[0_4px_16px_rgba(212,113,75,0.2)]",
  ghost: "bg-transparent text-azul hover:bg-blanco/5 active:bg-blanco/10",
};

export function Button({ variant = "primary", children, className = "", disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`
        min-h-[48px] px-(--space-6) rounded-(--radius-md)
        font-[family-name:var(--font-body)] font-semibold text-base
        transition-all duration-200
        disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
        ${variantStyles[variant]}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
