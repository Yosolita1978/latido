"use client";

import { Card } from "@/components/ui/Card";
import { ProgressArc } from "@/components/ui/ProgressArc";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

interface ReflectionViewProps {
  completionRate: number | null;
  reflection: string | null;
  tasksCompleted: number;
  tasksDeferred: number;
  totalTasks: number;
}

export function ReflectionView({
  completionRate,
  reflection,
  tasksCompleted,
  tasksDeferred,
  totalTasks,
}: ReflectionViewProps) {
  if (completionRate === null || !reflection) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] gap-[var(--space-4)]">
        <div className="text-6xl text-azul/30">◐</div>
        <p className="text-gris text-center">
          La reflexión se genera al final del día.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <Card variant="elevated">
        <div className="flex flex-col items-center gap-[var(--space-4)] py-[var(--space-4)]">
          <ProgressArc completed={tasksCompleted} total={totalTasks} />
          <p className="text-sm text-gris">{completionRate}% completado</p>

          <p className="text-base text-blanco italic font-[family-name:var(--font-heading)] text-center px-[var(--space-2)] leading-relaxed">
            &ldquo;{reflection}&rdquo;
          </p>

          <div className="flex gap-[var(--space-3)]">
            <Badge label={`${tasksCompleted} completadas`} category="personal" />
            <Badge label={`${tasksDeferred} diferidas`} category="admin" />
          </div>
        </div>
      </Card>

      <Link
        href="/reflexion/patrones"
        className="text-center text-azul font-[family-name:var(--font-body)] font-medium hover:underline"
      >
        Ver mis patrones →
      </Link>
    </div>
  );
}
