"use client";

interface InputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Input({ label, className = "", ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm text-gris mb-[var(--space-1)] font-[family-name:var(--font-body)]">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full min-h-[120px] p-[var(--space-4)]
          bg-crema text-negro text-lg
          rounded-[var(--radius-md)]
          border-2 border-transparent
          focus:border-azul focus:outline-none
          placeholder:text-gris
          font-[family-name:var(--font-body)]
          resize-none
          ${className}
        `}
        {...props}
      />
    </div>
  );
}
