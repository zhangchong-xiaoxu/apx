// The corner cards: a newer release and a star on GitHub, one at a time, each said once per device (the
// update card again each time APX opens, until it is updated). The core's update answer is stood in for (the sandbox never asks the release feed).
import type { Route } from "@playwright/test";
import { expect, open, test } from "./kit.ts";

test.use({ cornerCards: true });

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("closing the fork invitation persists without promoting an upstream community", async ({ page }) => {
  await open(page);
  const corner = page.getByRole("complementary", { name: "Novedades e invitaciones" });
  await expect(corner.locator('[data-card="discord"]')).toHaveCount(0);
  await expect(corner.getByText("Sumate a la comunidad")).toBeHidden();
  await expect(corner.getByText("¿Te gusta APX?")).toBeVisible();
  await corner.locator('[data-card="star"]').getByRole("button", { name: "Cerrar" }).click();
  await expect(corner).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Inbox" })).toBeVisible();
  await expect(corner).toBeHidden();
});

test("acting on the fork invitation opens its repository and dismisses the card", async ({ page }) => {
  await open(page);
  const corner = page.getByRole("complementary", { name: "Novedades e invitaciones" });
  // Acting on it is enough: the repo opens in a new tab and the card does not come back.
  const popup = page.waitForEvent("popup");
  await page.context().route("https://github.com/**", (route) => route.fulfill({ body: "ok" }));
  await corner.getByRole("button", { name: "Dar una estrella" }).click();
  expect((await popup).url()).toBe("https://github.com/zhangchong-xiaoxu/apx");
  await expect(corner).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Inbox" })).toBeVisible();
  await expect(corner).toBeHidden();
});

test("a newer release goes first, opens the update dialog, and once closed comes back when APX opens again", async ({
  page,
}) => {
  let latest = "9.1.0";
  await page.route("**/rpc/system.updates", async (route: Route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { ok: boolean; result: Record<string, unknown> };
    await route.fulfill({
      response: res,
      json: { ...body, result: { ...body.result, source: "release", behind: 1, latest, changes: ["feat: a"] } },
    });
  });
  await open(page);
  const card = page.locator('[data-card="update"]');
  await expect(card.getByText("Salió APX 9.1.0")).toBeVisible();
  await card.getByRole("button", { name: "Ver novedades" }).click();
  const dialog = page.getByRole("dialog", { name: "Hay una versión nueva de APX" });
  await expect(dialog.getByText("feat: a")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Closed, it leaves for now: the next card comes forward.
  await card.getByRole("button", { name: "Cerrar" }).click();
  await expect(card).toBeHidden();
  await expect(page.getByText("¿Te gusta APX?")).toBeVisible();
  // An update left for later is said again the next time APX opens.
  await page.reload();
  await expect(card.getByText("Salió APX 9.1.0")).toBeVisible();

  latest = "9.2.0";
  await page.reload();
  await expect(card.getByText("Salió APX 9.2.0")).toBeVisible();
});

test("an install from before telemetry is asked once in the corner, and closing the card is a no", async ({ page }) => {
  const asked: boolean[] = [];
  let usage: boolean | null = null;
  const state = () => ({
    enabled: true,
    install_id: "6f1c2b9e-1d2a-4c3b-8e4f-5a6b7c8d9e0f",
    usage,
    sent: {},
    last: null,
    preview: { tokens_in: 0, tokens_out: 0, runs: 0, projects: 1, agents: 1, channels: 0, routines: 0 },
  });
  // The sandbox core sends nothing (APX_TELEMETRY=off): the panel is shown one that would.
  await page.route("**/rpc/telemetry.get", (route: Route) => route.fulfill({ json: { ok: true, result: state() } }));
  await page.route("**/rpc/telemetry.set", async (route: Route) => {
    usage = (route.request().postDataJSON() as { usage: boolean }).usage;
    asked.push(usage);
    await route.fulfill({ json: { ok: true, result: state() } });
  });
  await open(page);
  const card = page.locator('[data-card="telemetry"]');
  await expect(card.getByText("Ayudá a mejorar APX")).toBeVisible();
  // It says where to read what is sent before anyone answers.
  await expect(card.getByRole("link", { name: "Qué se envía" })).toHaveAttribute(
    "href",
    "https://github.com/zhangchong-xiaoxu/apx/blob/master/apps/docs/src/content/docs/reference/privacy.mdx",
  );
  await card.getByRole("button", { name: "Cerrar" }).click();
  await expect(card).toBeHidden();
  expect(asked).toEqual([false]);
  await page.reload();
  await expect(page.getByText("¿Te gusta APX?")).toBeVisible();
  await expect(card).toBeHidden();
});
