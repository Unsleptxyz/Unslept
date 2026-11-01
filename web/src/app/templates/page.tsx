import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { RevealObserver } from "@/components/Reveal";
import { PageCta, SubpageHero } from "@/components/landing/Pages";
import { CodeTabs } from "@/components/landing/CodeTabs";
import { site } from "@/lib/config";

export const metadata: Metadata = {
  title: "Agent templates",
  description: "Ready-to-run agents that pay x402 APIs from an Unslept account: TypeScript, Claude Desktop over MCP, LangChain, and a paid API for providers.",
};

const ROOT = join(process.cwd(), "..", "examples", "templates");
const read = (rel: string, fallback: string) => {
  try {
    return readFileSync(join(ROOT, rel), "utf8").trim();
  } catch {
    return fallback;
  }
};

const templates = [
  {
    slug: "research-agent",
    eyebrow: "TypeScript",
    title: "Research agent",
    body: "Discovers paid APIs in the x402 Directory and calls them, paying per request within a budget you set.",
    tags: ["Node 20", "@unslept/sdk", "Directory"],
    files: [{ filename: "agent.ts", rel: "research-agent/agent.ts" }],
    run: "npm install && npm start",
  },
  {
    slug: "claude-mcp",
    eyebrow: "MCP",
    title: "Claude Desktop that pays",
    body: "Gives Claude Desktop, or any MCP client, tools to pay x402 requests from its own agent account. Claude asks before each paid call.",
    tags: ["Claude Desktop", "@unslept/mcp", "No code"],
    files: [{ filename: "claude_desktop_config.json", rel: "claude-mcp/claude_desktop_config.json" }],
    run: "Merge the config, fill in two values, restart Claude Desktop",
  },
  {
    slug: "langchain-agent",
    eyebrow: "Python",
    title: "LangChain agent",
    body: "A tool-calling LangChain agent with a fetch tool that pays x402 endpoints and respects the account's caps.",
    tags: ["Python 3.10+", "unslept", "LangChain"],
    files: [{ filename: "agent.py", rel: "langchain-agent/agent.py" }],
    run: "pip install -r requirements.txt && python agent.py",
  },
  {
    slug: "paid-api",
    eyebrow: "For providers",
    title: "Paid API endpoint",
    body: "A Next.js route that charges agents 0.01 USDC per request with Unslept Pay. Deploy it and list it in the directory.",
    tags: ["Next.js", "@unslept/pay", "Earn"],
    files: [{ filename: "app/api/quote/route.ts", rel: "paid-api/app/api/quote/route.ts" }],
    run: "npm install @unslept/pay",
  },
];

export const dynamic = "force-static";

export default function TemplatesPage() {
  const repo = site.githubUrl ? `${site.githubUrl.replace(/\/$/, "")}/tree/main/examples/templates` : undefined;
  return (
    <>
      <SiteHeader docsUrl={site.docsUrl} active="/templates" />
      <main id="main">
        <SubpageHero
          id="templates-title"
          eyebrow="Agent templates"
          title={
            <>
              Start from an agent <em>that already pays.</em>
            </>
          }
          lede="Four starting points that run against Unslept on Solana mainnet. Create an agent account in the app, copy the environment from the Developers tab, and run."
          actions={
            <>
              <a className="btn btn--primary btn--large" href="/app/developers">
                Get your environment
              </a>
              {repo ? (
                <a className="btn btn--ghost btn--large" href={repo} rel="noopener noreferrer" target="_blank">
                  View on GitHub
                </a>
              ) : null}
            </>
          }
        />
        <section className="section" aria-label="Templates">
          <div className="container tpl-list">
            {templates.map((t, i) => (
              <article key={t.slug} className="card tpl" data-reveal style={{ ["--reveal-i" as string]: i % 2 }}>
                <div className="tpl__info">
                  <p className="eyebrow">{t.eyebrow}</p>
                  <h2 className="display tpl__title">{t.title}</h2>
                  <p className="tpl__body">{t.body}</p>
                  <ul className="tpl__tags">
                    {t.tags.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                  <p className="tpl__run">
                    <span className="muted small">Run</span>
                    <code>{t.run}</code>
                  </p>
                  {repo ? (
                    <a className="arrow-link" href={`${repo}/${t.slug}`} rel="noopener noreferrer" target="_blank">
                      Open the template
                    </a>
                  ) : null}
                </div>
                <div className="tpl__code">
                  <CodeTabs tabs={t.files.map((f) => ({ label: f.filename.split("/").pop()!, filename: f.filename, code: read(f.rel, "// See the template on GitHub") }))} />
                </div>
              </article>
            ))}
          </div>
        </section>
        <PageCta next={{ href: "/directory", label: "Browse paid APIs" }} />
      </main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
      <RevealObserver />
    </>
  );
}
