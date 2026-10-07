import { format, isSameWeek, parseISO, startOfWeek, subWeeks } from "date-fns";

export function sessionDateLabel(iso: string): string {
  return format(parseISO(iso), "do MMMM");
}

export function sessionLine(workout: { finishedAt: string | null; label: string }): string {
  const date = workout.finishedAt ? sessionDateLabel(workout.finishedAt) : "";
  return [date, workout.label].filter(Boolean).join(". ");
}

export function weekHeading(iso: string, now = new Date()): string {
  const date = parseISO(iso);
  if (isSameWeek(date, now, { weekStartsOn: 1 })) return "This week";
  if (isSameWeek(date, subWeeks(now, 1), { weekStartsOn: 1 })) return "Last week";
  return `Week of ${format(startOfWeek(date, { weekStartsOn: 1 }), "d MMM")}`;
}

export function durationLabel(start: string, end: string | null): string | null {
  if (!end) return null;
  const ms = parseISO(end).getTime() - parseISO(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
