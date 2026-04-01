"use client";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  children: React.ReactNode;
}

const variantStyles = {
  primary: "bg-azul text-blanco hover:bg-azul-light active:bg-azul-light",
  secondary: "bg-terracotta text-blanco hover:opacity-90 active:opacity-80",
  ghost: "bg-transparent text-azul hover:bg-crema active:bg-crema",
};

export function Button({ variant = "primary", children, className = "", disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`
        min-h-[48px] px-[var(--space-6)] rounded-[var(--radius-md)]
        font-[family-name:var(--font-body)] font-semibold text-base
        transition-colors duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
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
