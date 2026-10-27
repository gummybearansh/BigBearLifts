import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start py-10">
      <img src="/atmosphere/empty-mark.jpg" alt="" className="mb-4 h-24 w-24 rounded-2xl object-cover" />
      <p className="text-xl font-medium">{title}</p>
      <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
