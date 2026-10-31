import { PageShell } from "@/components/PageShell";
import { Toc } from "@/components/content/Toc";
import { docGroups, docs, type DocPage } from "./content";

const href = (d: DocPage) => (d.slug ? `/docs/${d.slug}` : "/docs");

function DocsNav({ page }: { page: DocPage }) {
  return (
    <>
      {docGroups.map((g) => (
        <div key={g} className="docs__group">
          <p className="docs__group-title">{g}</p>
          {docs
            .filter((d) => d.group === g)
            .map((d) => (
              <a key={d.slug} href={href(d)} aria-current={d.slug === page.slug ? "page" : undefined}>
                {d.nav ?? d.title}
              </a>
            ))}
        </div>
      ))}
    </>
  );
}

export function DocView({ page }: { page: DocPage }) {
  const i = docs.findIndex((d) => d.slug === page.slug);
  const prev = i > 0 ? docs[i - 1] : undefined;
  const next = i >= 0 && i < docs.length - 1 ? docs[i + 1] : undefined;
  return (
    <PageShell progress>
      <div className="docs container">
        <aside className="docs__sidebar">
          <nav aria-label="Documentation" className="docs__nav">
            <DocsNav page={page} />
          </nav>
          <details className="docs__menu">
            <summary>
              <span>Documentation</span>
              <span className="docs__menu-current">{page.nav ?? page.title}</span>
            </summary>
            <nav aria-label="Documentation, mobile">
              <DocsNav page={page} />
            </nav>
          </details>
        </aside>
        <article id="doc-article" className="docs__article prose">
          <p className="eyebrow">{page.group}</p>
          <h1 className="display docs__title">{page.title}</h1>
          <p className="docs__desc">{page.description}</p>
          <div className="docs__body">{page.body}</div>
          <nav className="docs__pager" aria-label="Pagination">
            {prev ? (
              <a href={href(prev)} className="docs__pager-link">
                <span>Previous</span>
                {prev.nav ?? prev.title}
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a href={href(next)} className="docs__pager-link docs__pager-link--next">
                <span>Next</span>
                {next.nav ?? next.title}
              </a>
            ) : null}
          </nav>
        </article>
        <aside className="docs__toc">
          <Toc rootId="doc-article" />
        </aside>
      </div>
    </PageShell>
  );
}
