import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Chip({
  active = false,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        "inline-flex h-11 items-center rounded-full border px-3 text-sm font-medium transition-transform duration-150 active:scale-[0.98]",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-foreground",
        className,
      )}
      {...props}
    />
  );
}
