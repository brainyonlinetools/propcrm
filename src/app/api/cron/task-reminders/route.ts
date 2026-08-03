import { NextResponse } from "next/server";
import { verifyBearerSecret, unauthorized } from "@/lib/apiAuth";
import { sendTaskReminderPush } from "@/lib/pushNotifications";
import { getTaskReminderAt } from "@/lib/taskReminders";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

interface DueTask {
  id: string;
  title: string;
  due_date: string;
  due_time: string | null;
  lead_id: string;
  leads: { name: string } | null;
}

export async function GET(request: Request) {
  if (!verifyBearerSecret(request, "CRON_SECRET")) {
    return unauthorized();
  }

  const supabase = createSupabaseAdmin();
  const now = new Date();

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, title, due_date, due_time, lead_id, leads(name)")
    .eq("is_done", false)
    .not("due_date", "is", null)
    .is("reminder_sent_at", null);

  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  const dueTasks = (tasks as DueTask[]).filter((task) => {
    if (!task.due_date) return false;
    return getTaskReminderAt(task.due_date, task.due_time) <= now;
  });

  if (dueTasks.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 });
  }

  let sent = 0;
  const staleEndpoints: string[] = [];

  for (const task of dueTasks) {
    const leadName = task.leads?.name ?? "Lead";
    const payload = {
      title: "Follow-up reminder",
      body: `${task.title} — ${leadName}`,
      url: `/leads/${task.lead_id}`,
    };

    if (subscriptions && subscriptions.length > 0) {
      for (const sub of subscriptions) {
        try {
          await sendTaskReminderPush(sub, payload);
          sent++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          }
        }
      }
    }

    await supabase
      .from("tasks")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", task.id);
  }

  if (staleEndpoints.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
  }

  return NextResponse.json({
    ok: true,
    tasks: dueTasks.length,
    sent,
    staleRemoved: staleEndpoints.length,
  });
}
