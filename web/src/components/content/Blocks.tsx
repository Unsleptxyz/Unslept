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

/** How to reach the project: GitHub issues for questions, a private GitHub security advisory for vulnerabilities. */
export function ContactLine({ purpose = "Questions and data requests" }: { purpose?: string }) {
  const security = /security/i.test(purpose);
  if (site.githubUrl) {
    if (security) {
      return (
        <>
          Report it privately through a{" "}
          <a className="text-link" href={`${site.githubUrl}/security/advisories/new`} rel="noopener noreferrer" target="_blank">
            GitHub security advisory
          </a>{" "}
          on the Unslept repository. Do not open a public issue or share details elsewhere.
        </>
      );
    }
    return (
      <>
        {purpose} go through{" "}
        <a className="text-link" href={`${site.githubUrl}/issues`} rel="noopener noreferrer" target="_blank">
          GitHub issues
        </a>{" "}
        on the Unslept repository. Security reports go through a private{" "}
        <a className="text-link" href={`${site.githubUrl}/security/advisories/new`} rel="noopener noreferrer" target="_blank">
          GitHub security advisory
        </a>
        , never a public issue.
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
  return <>Contact details for {purpose.toLowerCase()} will be published on this page.</>;
}
