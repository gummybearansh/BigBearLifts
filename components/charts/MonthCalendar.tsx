"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { format } from "date-fns";
import { localDateKey } from "@/lib/training";

export const TRAIN_COLOR = "#FF5A1F";
export const REST_COLOR = "#4C8DFF";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function MonthCalendar({
  trained,
  rest,
  links,
}: {
  trained: string[];
  rest: string[];
  links?: Record<string, string>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const trainedKeys = new Set(trained.map(localDateKey));
  const restKeys = new Set(rest.map(localDateKey));
  const months = monthRange(trainedKeys, restKeys);

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [months.length]);

  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: TRAIN_COLOR }} />
          Trained
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: REST_COLOR }} />
          Rest
        </span>
      </div>
      <div ref={scroller} className="max-h-[28rem] overflow-y-auto pr-1">
        <div className="flex flex-col gap-6">
          {months.map((month) => (
            <section key={month.key} aria-label={month.label}>
              <h3 className="mb-2 text-sm font-medium">{month.label}</h3>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {month.cells.map((cell, index) => (
                  <DayCell
                    key={cell?.key ?? `pad-${month.key}-${index}`}
                    cell={cell}
                    trained={cell ? trainedKeys.has(cell.key) : false}
                    rest={cell ? restKeys.has(cell.key) && !trainedKeys.has(cell.key) : false}
                    href={cell ? links?.[cell.key] : undefined}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayCell({
  cell,
  trained,
  rest,
  href,
}: {
  cell: { key: string; day: number; today: boolean } | null;
  trained: boolean;
  rest: boolean;
  href?: string;
}) {
  if (!cell) return <span className="h-10" />;
  const className = "flex h-10 items-center justify-center rounded-lg text-sm font-medium";
  const style = trained
    ? { background: TRAIN_COLOR, color: "#0A0A0B" }
    : rest
      ? { background: REST_COLOR, color: "#0A0A0B" }
      : undefined;
  const tone = trained || rest ? "" : cell.today ? "text-foreground ring-1 ring-foreground" : "text-muted-foreground";
  if (href) {
    return (
      <Link href={href} className={`${className} ${tone}`} style={style} aria-label={cell.key}>
        {cell.day}
      </Link>
    );
  }
  return (
    <span className={`${className} ${tone}`} style={style} aria-label={cell.key}>
      {cell.day}
    </span>
  );
}

function monthRange(trained: Set<string>, rest: Set<string>): { key: string; label: string; cells: ({ key: string; day: number; today: boolean } | null)[] }[] {
  const today = new Date();
  const cursor = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  for (const key of [...trained, ...rest]) {
    const [year, month] = key.split("-").map(Number);
    if (!year || !month) continue;
    const candidate = new Date(year, month - 1, 1);
    if (candidate < cursor) cursor.setTime(candidate.getTime());
  }
  const end = new Date(today.getFullYear(), today.getMonth(), 1);
  const months: { key: string; label: string; cells: ({ key: string; day: number; today: boolean } | null)[] }[] = [];
  const walk = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  while (walk <= end) {
    months.push({
      key: `${walk.getFullYear()}-${walk.getMonth()}`,
      label: format(walk, "MMMM yyyy"),
      cells: monthCells(walk.getFullYear(), walk.getMonth(), today),
    });
    walk.setMonth(walk.getMonth() + 1);
  }
  return months;
}

function monthCells(year: number, month: number, today: Date): ({ key: string; day: number; today: boolean } | null)[] {
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const todayKey = localDateKey(today);
  const cells: ({ key: string; day: number; today: boolean } | null)[] = Array.from({ length: pad }, () => null);
  for (let day = 1; day <= count; day += 1) {
    const date = new Date(year, month, day);
    const key = localDateKey(date);
    cells.push({ key, day, today: key === todayKey });
  }
  return cells;
}
