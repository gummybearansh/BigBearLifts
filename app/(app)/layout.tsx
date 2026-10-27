import { BottomNav } from "@/components/layout/BottomNav";
import { Reminders } from "@/components/reminders/Reminders";
import { SyncProvider } from "@/components/sync/SyncProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SyncProvider>
      <div className="mx-auto min-h-dvh w-full min-w-0 max-w-lg overflow-x-hidden">
        <Reminders />
        {children}
        <BottomNav />
      </div>
    </SyncProvider>
  );
}
