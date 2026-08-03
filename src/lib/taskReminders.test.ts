import { describe, expect, it } from "vitest";
import {
  DEFAULT_TASK_REMINDER_TIME,
  formatTaskDueTime,
  getTaskReminderAt,
} from "./taskReminders";

describe("getTaskReminderAt", () => {
  it("defaults to 9:00 AM IST when due_time is null", () => {
    const reminder = getTaskReminderAt("2026-08-05", null);
    expect(reminder.toISOString()).toBe("2026-08-05T03:30:00.000Z");
  });

  it("uses custom due_time in IST", () => {
    const reminder = getTaskReminderAt("2026-08-05", "14:30");
    expect(reminder.toISOString()).toBe("2026-08-05T09:00:00.000Z");
  });
});

describe("formatTaskDueTime", () => {
  it("formats default time as 9:00 AM", () => {
    expect(formatTaskDueTime(null)).toBe("9:00 AM");
    expect(formatTaskDueTime(DEFAULT_TASK_REMINDER_TIME)).toBe("9:00 AM");
  });

  it("formats afternoon time", () => {
    expect(formatTaskDueTime("14:30")).toBe("2:30 PM");
  });
});
