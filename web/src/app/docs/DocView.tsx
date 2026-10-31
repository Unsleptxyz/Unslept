import { PageShell } from "@/components/PageShell";
import { docs, type DocPage } from "./content";

export function DocView({ page }: { page: DocPage }) {
  return (
    <PageShell>
      <div className="docs-layout">
        <nav aria-label="Documentation" className="docs-nav">
          {docs.map((d) => (
            <a key={d.slug} href={d.slug ? `/docs/${d.slug}` : "/docs"} aria-current={d.slug === page.slug ? "page" : undefined}>
              {d.title}
            </a>
          ))}
        </nav>
        <article className="prose-page">
          <h1 className="display">{page.title}</h1>
          <p className="page-intro">{page.description}</p>
          <div style={{ marginTop: "2rem" }}>{page.body}</div>
        </article>
      </div>
    </PageShell>
  );
}
