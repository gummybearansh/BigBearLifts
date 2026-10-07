import type { Metadata } from "next";
import { ProgramScreen } from "@/components/program/ProgramScreen";

export const metadata: Metadata = { title: "Program" };

export default function ProgramPage() {
  return <ProgramScreen />;
}
