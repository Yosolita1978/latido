"use client";

import { Card } from "@/components/ui/Card";
import { ProgressArc } from "@/components/ui/ProgressArc";
import { Badge } from "@/components/ui/Badge";

interface ReflectionViewProps {
  completionRate: number | null;
  reflection: string | null;
  tasksCompleted: number;
  tasksDeferred: number;
}

export function ReflectionView({
  completionRate,
  reflection,
  tasksCompleted,
  tasksDeferred,
}: ReflectionViewProps) {
  if (completionRate === null || !reflection) {
    return (
      <div className="flex flex-col items-center py-(--space-8) gap-(--space-4)">
        <div className="text-4xl text-azul/20">◐</div>
        <p className="text-gris text-center text-sm font-[family-name:var(--font-body)]">
          La reflexión se genera al final del día.
        </p>
      </div>
    );
  }

  return (
    <Card variant="elevated">
      <div className="flex flex-col items-center gap-(--space-4) py-(--space-4)">
        <ProgressArc score={Math.round((completionRate / 100) * 5)} size={120} strokeWidth={7} />
        <p className="text-sm text-gris font-[family-name:var(--font-body)]">{completionRate}% completado</p>

        <p className="text-base text-blanco/90 italic font-[family-name:var(--font-heading)] text-center px-(--space-2) leading-relaxed">
          &ldquo;{reflection}&rdquo;
        </p>

        <div className="flex gap-(--space-3)">
          <Badge label={`${tasksCompleted} completadas`} category="personal" />
          <Badge label={`${tasksDeferred} diferidas`} category="admin" />
        </div>
      </div>
    </Card>
  );
}
