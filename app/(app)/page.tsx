import type { Metadata } from "next";
import { TodayHome } from "@/components/today/TodayHome";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return <TodayHome />;
}
