import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { sitePath } from "../src/doc-routes.mjs";

const dist = new URL("../dist/", import.meta.url);
const base = (process.env.DOCS_BASE ?? "/").replace(/\/$/, "");
const site = process.env.DOCS_SITE ?? "http://localhost:4400";

test("every built documentation page has a legacy redirect and a canonical new address", async () => {
  let count = 0;
  for (const prefix of ["", "es/"]) {
    const entries = await readdir(new URL(`${prefix}docs/`, dist), { recursive: true });
    for (const entry of entries.filter((file) => file.endsWith("index.html") && file !== "index.html")) {
      const file = entry.split(path.sep).join("/");
      const route = `${prefix}docs/${file.replace(/index\.html$/, "")}`;
      const html = await readFile(new URL(`${route}index.html`, dist), "utf8");
      const canonical = new URL(`${base}/${route}`, site).href;
      assert.ok(html.includes(`rel="canonical" href="${canonical}"`), route);
      const legacy = route.replace(/^(es\/)?docs\//, "$1");
      const redirect = await readFile(new URL(`${legacy}index.html`, dist), "utf8");
      assert.ok(redirect.includes(`content="0;url=${base}/${route}"`), legacy);
      assert.ok(redirect.includes(`rel="canonical" href="${canonical}"`), legacy);
      assert.ok(redirect.includes('content="noindex,follow"'), legacy);
      count++;
    }
  }
  assert.equal(count, 80, "all existing documentation pages and both website privacy pages are preserved");
});

test("sitemap lists only canonical pages, including bilingual documentation and comparisons", async () => {
  const xml = await readFile(new URL("sitemap-0.xml", dist), "utf8");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(urls.length, new Set(urls).size);
  const canonicalPages = new Set();
  for (const entry of await readdir(dist, { recursive: true })) {
    if (!entry.endsWith(".html")) continue;
    const file = entry.split(path.sep).join("/");
    if (file === "404.html") continue;
    const route = file === "index.html" ? "/" : `/${file.replace(/index\.html$/, "")}`;
    if (route === "/404/" || route === "/docs/" || route === "/es/docs/" || sitePath(route) !== route) continue;
    const html = await readFile(new URL(file, dist), "utf8");
    if (html.includes('content="noindex,follow"')) continue;
    canonicalPages.add(new URL(`${base}${route}`, site).href);
  }
  assert.deepEqual(new Set(urls), canonicalPages);
  assert.ok(urls.includes(`${site}${base}/docs/reference/website-privacy/`));
  assert.ok(urls.includes(`${site}${base}/es/docs/reference/website-privacy/`));
  assert.ok(urls.includes(`${site}${base}/docs/start/introduction/`));
  assert.ok(urls.includes(`${site}${base}/es/docs/start/introduction/`));
  assert.ok(urls.includes(`${site}${base}/compare/openbot/`));
  assert.ok(!urls.includes(`${site}${base}/start/introduction/`));
  assert.ok(!urls.includes(`${site}${base}/es/start/introduction/`));
  assert.ok(!urls.includes(`${site}${base}/docs/`));
});
