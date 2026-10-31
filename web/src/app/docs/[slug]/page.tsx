import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocView } from "../DocView";
import { docs, findDoc } from "../content";

export const dynamicParams = false;

export function generateStaticParams() {
  return docs.filter((d) => d.slug).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = findDoc(slug);
  return page ? { title: page.title, description: page.description } : {};
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = findDoc(slug);
  if (!page) notFound();
  return <DocView page={page} />;
}
