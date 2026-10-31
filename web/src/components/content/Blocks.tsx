import type { ReactNode } from "react";
import { highlight } from "@/lib/highlight";
import { CopyButton } from "@/components/landing/Interactive";
import { site } from "@/lib/config";

/** Building blocks for long-form pages: docs, risk, terms and privacy. */

export function Callout({ tone = "note", title, children }: { tone?: "note" | "warning" | "tip"; title?: string; children: ReactNode }) {
  return (
    <aside className={`callout callout--${tone}`} role="note">
      {title ? <p className="callout__title">{title}</p> : null}
      <div className="callout__body">{children}</div>
    </aside>
  );
}

export function CodeBlock({ code, filename, lang }: { code: string; filename?: string; lang?: string }) {
  return (
    <div className="code-block">
      <div className="code-block__bar">
        <span className="code-block__file">{filename ?? lang ?? "code"}</span>
        <CopyButton text={code} />
      </div>
      <pre>
        <code>{highlight(code)}</code>
      </pre>
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="steps">{children}</ol>;
}

export function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="steps__item">
      <h3 className="steps__title">{title}</h3>
      <div className="steps__body">{children}</div>
    </li>
  );
}

export function Summary({ items }: { items: ReactNode[] }) {
  return (
    <section className="summary-box" aria-label="In short">
      <p className="summary-box__title">In short</p>
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </section>
  );
}

export function DefTable({ rows, head }: { rows: [ReactNode, ReactNode][]; head?: [string, string] }) {
  return (
    <div className="def-table">
      <table>
        {head ? (
          <thead>
            <tr>
              <th scope="col">{head[0]}</th>
              <th scope="col">{head[1]}</th>
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i}>
              <th scope="row">{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** How to reach the project. Uses the published contact email; otherwise says where it will appear. */
export function ContactLine({ purpose = "Questions, data requests and security reports" }: { purpose?: string }) {
  if (site.contactEmail) {
    return (
      <>
        {purpose} go to{" "}
        <a className="text-link" href={`mailto:${site.contactEmail}`}>
          {site.contactEmail}
        </a>
        . For security reports, put &quot;Security&quot; in the subject and do not share details publicly.
      </>
    );
  }
  if (site.xUrl) {
    return (
      <>
        {purpose} go through the project&apos;s official{" "}
        <a className="text-link" href={site.xUrl} rel="noopener noreferrer" target="_blank">
          X account
        </a>
        . For security reports, ask for a private channel and do not share details publicly.
      </>
    );
  }
  return <>A contact address for {purpose.toLowerCase()} will be published on this page.</>;
}
