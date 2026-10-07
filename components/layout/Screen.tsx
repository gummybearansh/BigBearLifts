import type { ReactNode } from "react";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";

export function Screen({
  title,
  hint,
  body,
  children,
}: {
  title: string;
  hint?: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} />
      <main className="flex min-h-[calc(100dvh-8rem)] flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children ?? (hint && body ? <EmptyState title={hint} body={body} /> : null)}
      </main>
    </>
  );
}
