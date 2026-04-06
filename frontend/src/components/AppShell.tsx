"use client";

import { useState, useEffect } from "react";
import { TabBar } from "@/components/ui/TabBar";
import { CaptureSheet } from "@/components/capture/CaptureSheet";
import { useUserId } from "@/components/AuthProvider";

interface Project {
  id: string;
  name: string;
  status?: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const userId = useUserId();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch(`/api/projects`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setProjects(
        data
          .filter((p: Project) => p.status === "active" || p.status === "blocked")
          .map((p: Project) => ({ id: p.id, name: p.name }))
      ))
      .catch(() => {});
  }, [userId]);

  return (
    <>
      <main className="flex-1 px-[var(--space-4)] pb-[var(--space-4)] max-w-lg mx-auto w-full">
        {children}
      </main>
      <TabBar onCaptureTap={() => setCaptureOpen(true)} />
      <CaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        projects={projects}
      />
    </>
  );
}
