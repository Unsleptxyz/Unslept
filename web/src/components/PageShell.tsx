import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import { site } from "@/lib/config";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader docsUrl={site.docsUrl} />
      <main id="main">{children}</main>
      <SiteFooter docsUrl={site.docsUrl} githubUrl={site.githubUrl} xUrl={site.xUrl} />
    </>
  );
}

export function LegalReviewNotice() {
  return (
    <div className="notice" role="note">
      <p>
        <strong>Not yet reviewed by a lawyer.</strong> This text describes how Unslept works today in plain terms. It
        may change after legal review; the date at the top shows the version in force.
      </p>
    </div>
  );
}
