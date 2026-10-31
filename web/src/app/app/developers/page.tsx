import type { Metadata } from "next";
import { DevelopersPage } from "@/components/app/Developers";

export const metadata: Metadata = { title: "Developers" };

export default function Page() {
  return <DevelopersPage />;
}
