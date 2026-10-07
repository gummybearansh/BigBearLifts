import type { Metadata } from "next";
import { VideosScreen } from "@/components/videos/VideosScreen";

export const metadata: Metadata = { title: "Videos" };

export default function VideosPage() {
  return <VideosScreen />;
}
