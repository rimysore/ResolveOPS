import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the ResolveOps product shell and metadata", async () => {
  const [page, layout, dashboard] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/resolveops-dashboard.tsx", root), "utf8"),
  ]);

  assert.match(page, /ResolveOpsDashboard/);
  assert.match(layout, /ResolveOps — AI operations you can verify/);
  assert.match(dashboard, /Outcome control/);
  assert.match(dashboard, /Release evidence/);
  assert.match(dashboard, /STRUCTURED TRACE DIFF/);
  assert.match(dashboard, /Same outcome. Different execution path/);
  assert.match(dashboard, /Approve bounded action/);
  assert.doesNotMatch(page + layout + dashboard, /codex-preview|site is taking shape/i);
});

test("removes all starter-only assets", async () => {
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
  const packageJson = await readFile(new URL("package.json", root), "utf8");
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("build output contains the product routes", async () => {
  await Promise.all([
    access(new URL(".next/BUILD_ID", root)),
    access(new URL("app/api/overview/route.ts", root)),
    access(new URL("app/api/cases/[id]/approve/route.ts", root)),
    access(new URL("lib/trace-diff.ts", root)),
  ]);
});
