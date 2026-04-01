import Image from "next/image";

export default function SemanaPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] gap-[var(--space-6)]">
      <Image
        src="/images/logo.png"
        alt="Latido"
        width={200}
        height={72}
        className="opacity-60"
      />
      <p className="text-gris text-center text-sm max-w-[260px]">
        La vista semanal viene pronto. Necesitamos al menos una semana de datos para mostrar tendencias.
      </p>
    </div>
  );
}
