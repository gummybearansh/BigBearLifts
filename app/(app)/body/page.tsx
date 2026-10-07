import type { Metadata } from "next";
import { BodyScreen } from "@/components/body/BodyScreen";

export const metadata: Metadata = { title: "Body" };

export default function BodyPage() {
  return <BodyScreen />;
}
