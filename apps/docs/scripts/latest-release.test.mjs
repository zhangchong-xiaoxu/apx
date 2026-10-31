import assert from "node:assert/strict";
import { test } from "node:test";
import { fillLatest } from "../src/components/latest-release.ts";
import { RELEASE_API, RELEASES_PAGE } from "../src/data/release-feed.ts";

test("the built and browser release links use the fork's release feed", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json([{ tag_name: "v2.11.2", draft: false, prerelease: false, assets: [] }]);
  };
  try {
    const { builtRelease, releasesPage } = await import("../src/data/latest-release.ts?fork-release-test");
    await fillLatest([]);
    assert.deepEqual(requests, [RELEASE_API, RELEASE_API]);
    assert.equal(releasesPage, RELEASES_PAGE);
    assert.equal(RELEASES_PAGE, "https://github.com/zhangchong-xiaoxu/apx/releases?q=v2&expanded=true");
    assert.equal(builtRelease, "v2.11.2");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
