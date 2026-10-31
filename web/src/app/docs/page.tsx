import type { Metadata } from "next";
import { DocView } from "./DocView";
import { findDoc } from "./content";

export const metadata: Metadata = { title: "Docs" };

export default function DocsIndex() {
  return <DocView page={findDoc("")!} />;
}
