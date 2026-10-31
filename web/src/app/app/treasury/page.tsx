import type { Metadata } from "next";
import { TreasuryPage } from "@/components/app/Treasury";

export const metadata: Metadata = { title: "Treasury" };

export default function Page() {
  return <TreasuryPage />;
}
