import type { Metadata } from "next";
import { AgentsPage } from "@/components/app/Agents";

export const metadata: Metadata = { title: "Agents" };

export default function Page() {
  return <AgentsPage />;
}
