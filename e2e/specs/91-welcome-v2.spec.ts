// The welcome is said once per device; its launch film is bundled, with no external player or media requests.
import { expect, open, test } from "./kit.ts";

test.use({ welcome: true });

test("the welcome shows once with the film, and closed it does not come back", async ({ page }) => {
  const externalMedia: string[] = [];
  page.on("request", (request) => {
    if (/agentprojectcontext\.github\.io|youtube|youtu\.be/.test(request.url())) externalMedia.push(request.url());
  });
  await open(page);
  const dialog = page.getByRole("dialog", { name: "APX v2 ya es la versión oficial" });
  await expect(dialog).toBeVisible();
  const film = dialog.getByLabel("APX v2: el superagente y su equipo trabajando");
  await expect(film).toBeVisible();
  await expect(film).toHaveAttribute("src", /^\/assets\/apx-v2-.*\.mp4$/);
  await expect.poll(() => film.evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(2);
  await expect(dialog.locator("iframe")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Vamos" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Inbox" })).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(externalMedia).toEqual([]);
});
