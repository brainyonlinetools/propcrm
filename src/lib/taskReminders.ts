export const DEFAULT_TASK_REMINDER_TIME = "09:00";
export const IST_OFFSET = "+05:30";

/** Combine due_date + optional due_time (HH:mm) into a Date in IST. Defaults to 9:00 AM IST. */
export function getTaskReminderAt(dueDate: string, dueTime: string | null): Date {
  const time = dueTime ?? DEFAULT_TASK_REMINDER_TIME;
  return new Date(`${dueDate}T${time}:00${IST_OFFSET}`);
}

/** Format due_time for display (e.g. "9:00 AM"). */
export function formatTaskDueTime(dueTime: string | null): string {
  const time = dueTime ?? DEFAULT_TASK_REMINDER_TIME;
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}
