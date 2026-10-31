import type { Metadata } from "next";
import { BufferPage } from "@/components/app/Buffer";

export const metadata: Metadata = { title: "Buffer" };

export default function Page() {
  return <BufferPage />;
}
