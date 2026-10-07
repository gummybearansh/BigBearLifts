import type { Metadata } from "next";
import { ProgressScreen } from "@/components/progress/ProgressScreen";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return <ProgressScreen />;
}
