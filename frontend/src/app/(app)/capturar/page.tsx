import { callTool } from "@/lib/mcp-client";
import { TEMP_USER_ID } from "@/lib/constants";
import { CaptureForm } from "@/components/capture/CaptureForm";

export const dynamic = "force-dynamic";

interface Project {
  id: string;
  name: string;
}

export default async function CapturarPage() {
  const projects = (await callTool("get_projects", {
    user_id: TEMP_USER_ID,
  })) as Project[];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl text-azul mb-[var(--space-6)]">
        ¿Qué necesitas hacer?
      </h1>
      <CaptureForm projects={projects} />
    </div>
  );
}
