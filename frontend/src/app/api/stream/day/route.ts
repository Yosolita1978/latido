import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const planDate = searchParams.get("plan_date");

  if (!userId || !planDate) {
    return Response.json(
      { error: "user_id and plan_date are required" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  let heartbeatInterval: ReturnType<typeof setInterval>;
  let supabase: ReturnType<typeof createServerClient>;

  const stream = new ReadableStream({
    start(controller) {
      supabase = createServerClient();

      // Send initial connection event
      controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"));

      // Subscribe to task status changes for this user
      const tasksChannel = supabase
        .channel(`tasks-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tasks",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const task = payload.new;
            const data = JSON.stringify({
              task_id: task.id,
              status: task.status,
              actual_minutes: task.actual_minutes,
              completed_at: task.completed_at,
            });
            controller.enqueue(encoder.encode(`event: task_update\ndata: ${data}\n\n`));
          },
        )
        .subscribe();

      // Subscribe to daily plan changes
      const plansChannel = supabase
        .channel(`plans-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "daily_plans",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const plan = payload.new;
            if (plan.plan_date === planDate) {
              const data = JSON.stringify({
                completion_rate: plan.completion_rate,
                total_completed_minutes: plan.total_completed_minutes,
              });
              controller.enqueue(encoder.encode(`event: plan_update\ndata: ${data}\n\n`));
            }
          },
        )
        .subscribe();

      // Heartbeat every 30s
      heartbeatInterval = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 30_000);

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        supabase.removeChannel(tasksChannel);
        supabase.removeChannel(plansChannel);
        controller.close();
      });
    },
    cancel() {
      clearInterval(heartbeatInterval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
