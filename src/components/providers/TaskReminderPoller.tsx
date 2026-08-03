"use client";

import { useEffect, useRef } from "react";
import { useTasks } from "@/lib/queries/tasks";
import { getTaskReminderAt } from "@/lib/taskReminders";

const POLL_INTERVAL_MS = 60_000;

export function TaskReminderPoller() {
  const { data: tasks = [] } = useTasks(false);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    function checkReminders() {
      const now = new Date();

      for (const task of tasks) {
        if (task.is_done || !task.due_date || task.reminder_sent_at) continue;
        if (notifiedRef.current.has(task.id)) continue;

        const reminderAt = getTaskReminderAt(task.due_date, task.due_time);
        if (reminderAt > now) continue;

        notifiedRef.current.add(task.id);
        const leadName = task.leads?.name ?? "Lead";

        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification("Follow-up reminder", {
              body: `${task.title} — ${leadName}`,
              icon: "/icons/icon-192.png",
              tag: `task-${task.id}`,
              data: { url: `/leads/${task.lead_id}` },
            });
          });
        } else {
          new Notification("Follow-up reminder", {
            body: `${task.title} — ${leadName}`,
            icon: "/icons/icon-192.png",
            tag: `task-${task.id}`,
          });
        }
      }
    }

    checkReminders();
    const interval = setInterval(checkReminders, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tasks]);

  return null;
}
