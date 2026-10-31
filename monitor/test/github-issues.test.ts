import { test } from "node:test";
import assert from "node:assert/strict";
import { sendGithubIssues } from "../src/monitor.js";

test("opens one issue per new alert and skips keys already reported", async () => {
  const posted: { title: string; body: string; labels: string[] }[] = [];
  const fake = (async (url: string, init?: RequestInit) => {
    if (!init?.method) {
      return new Response(JSON.stringify([{ body: "Old\n\nAlert key: `router-paused:2026-10-31`\n" }]), { status: 200 });
    }
    posted.push(JSON.parse(String(init.body)));
    return new Response("{}", { status: 201 });
  }) as typeof fetch;
  const env = { GITHUB_TOKEN: "t", GITHUB_REPOSITORY: "o/r" };
  const opened = await sendGithubIssues(
    [
      { key: "router-paused:2026-10-31", severity: "critical", text: "Settlement router is paused. Agents cannot pay." },
      { key: "buffer-paused:2026-10-31", severity: "critical", text: "Buffer is paused. Deposits stopped." },
    ],
    env,
    fake,
  );
  assert.equal(opened.length, 1);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].title, "[CRITICAL] Buffer is paused");
  assert.match(posted[0].body, /^Alert key: `buffer-paused:2026-10-31`$/m);
  assert.deepEqual(posted[0].labels, ["ops-alert", "critical"]);
});

test("does nothing without a token", async () => {
  const opened = await sendGithubIssues([{ key: "k", severity: "info", text: "x" }], {}, (() => {
    throw new Error("should not fetch");
  }) as unknown as typeof fetch);
  assert.equal(opened.length, 0);
});
