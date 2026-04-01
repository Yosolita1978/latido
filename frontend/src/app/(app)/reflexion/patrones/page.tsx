import { TEMP_USER_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase";
import { PatronesView } from "@/components/reflexion/PatronesView";

export const dynamic = "force-dynamic";

export default async function PatronesPage() {
  const db = createServerClient();
  const { data: patterns } = await db
    .from("user_patterns")
    .select("id, pattern_key, pattern_value, confidence, last_updated")
    .eq("user_id", TEMP_USER_ID)
    .order("confidence", { ascending: false });

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl text-azul">
          Lo que Latido sabe de ti
        </h1>
        <p className="text-sm text-gris mt-[var(--space-1)]">
          Estos patrones se aprenden de tu actividad diaria. Puedes eliminar cualquiera.
        </p>
      </div>
      <PatronesView patterns={patterns ?? []} />
    </div>
  );
}
