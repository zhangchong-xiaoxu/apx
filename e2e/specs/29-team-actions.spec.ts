// The team's own actions: a new agent from "+ Agente", and a right-click menu on every card and row to see, edit,
// chat with or delete it. The super-agent cannot be deleted; a project agent's file is archived, never erased.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { AGENT_NAMES } from "../../packages/protocol/src/constants.ts";
import type { AgentBudget } from "../../packages/protocol/src/team-methods.ts";
import { expect, open, rpc, test } from "./kit.ts";

let budgetsBefore: Record<string, AgentBudget> | undefined;
let reviewer: string | undefined;

test.beforeEach(async () => {
  budgetsBefore = undefined;
  reviewer = undefined;
  budgetsBefore = (await rpc<{ agents: Record<string, AgentBudget> }>("agents.limits")).agents;
});

test.afterEach(async () => {
  if (!budgetsBefore) throw new Error("Cannot restore agent budgets without a baseline");
  const current = (await rpc<{ agents: Record<string, AgentBudget> }>("agents.limits")).agents;
  for (const agent of new Set([...Object.keys(budgetsBefore), ...Object.keys(current)])) {
    if (!isDeepStrictEqual(budgetsBefore[agent], current[agent]))
      await rpc("agents.set_agent_limits", { agent, limits: budgetsBefore[agent] ?? null, merge: false });
  }
  if (reviewer) {
    await rpc("agents.archive", { agent: reviewer });
    await rpc("agents.delete", { agent: reviewer });
  }
  expect((await rpc<{ agents: Record<string, AgentBudget> }>("agents.limits")).agents).toEqual(budgetsBefore);
});

test("a global agent is created from the team, edited and deleted from its right-click menu", async ({ page }) => {
  await rpc("setup.finish", {});
  await open(page, "#project=~default&tab=team");

  await page.getByRole("button", { name: "Agente", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo agente" });
  // It opens with a person's name from APX's generator, none the crew uses; the dice draws another.
  const name = dialog.getByLabel("Nombre", { exact: true });
  const drawn = await name.inputValue();
  expect(AGENT_NAMES as readonly string[]).toContain(drawn);
  const crew = (await rpc<{ agents: Array<{ name: string }> }>("agents.list", {})).agents.map((a) => a.name);
  expect(crew).not.toContain(drawn);
  await dialog.getByRole("button", { name: "Otro nombre" }).click();
  await expect(name).not.toHaveValue(drawn);
  await name.fill("Northwind Analyst");
  await dialog.getByLabel("Rol").fill("Reads the numbers");
  await dialog.getByRole("button", { name: "Crear agente" }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.locator(".teamcanvas__node", { hasText: "Northwind Analyst" });
  await expect(card).toBeVisible();

  await card.click({ button: "right" });
  await expect(page.getByRole("menuitem")).toHaveText([
    "Ver detalle",
    "Editar",
    "Chatear",
    "Orquestador",
    "Borrar agente",
  ]);
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await expect(page.getByRole("dialog", { name: "Editar a Northwind Analyst" })).toBeVisible();
  await page.keyboard.press("Escape");

  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Borrar agente" }).click();
  const confirm = page.getByRole("dialog", { name: "¿Borrar a Northwind Analyst?" });
  await confirm.getByRole("button", { name: "Borrar agente" }).click();
  await expect(card).toHaveCount(0);

  // The super-agent says why it cannot go.
  await page.locator(".teamcanvas__node:has(.apx-agentnode.is-lead)").click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Borrar agente" })).toBeDisabled();
  await expect(page.getByText("El super-agente no se puede borrar")).toBeVisible();
  await page.keyboard.press("Escape");

  // The list view has the same menu, on right-click and on its "…" button.
  await page.getByRole("radio", { name: "Lista" }).click();
  const row = page.locator(".team__row").first();
  await row.getByRole("button", { name: /^Opciones de / }).click();
  await expect(page.getByRole("menuitem")).toHaveText(["Ver detalle", "Editar", "Chatear", "Borrar agente"]);
  await expect(page.getByText("El super-agente no se puede borrar")).toBeVisible();
});

test("a project agent is written to .apc/agents/ and, deleted, archived with its reports moved up", async ({
  page,
}) => {
  await rpc("setup.finish", {});
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "apx-e2e-team-")));
  const agents = path.join(repo, ".apc", "agents");
  fs.mkdirSync(agents, { recursive: true });
  fs.writeFileSync(path.join(repo, "AGENTS.md"), "# Acme\n");
  fs.writeFileSync(path.join(agents, "boss.md"), "---\nname: Boss\nrole: Orchestrator\n---\n\nLead.\n");
  const project = (await rpc<{ project: { id: string } }>("projects.register", { path: repo })).project.id;
  await open(page, `#project=${project}&tab=team`);

  await page.getByRole("button", { name: "Agente", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo agente" });
  await dialog.getByLabel("Nombre", { exact: true }).fill("Ana Pérez");
  await expect(dialog.getByText(".apc/agents/ana-perez.md")).toBeVisible();
  await dialog.getByRole("button", { name: "Crear agente" }).click();
  await expect.poll(() => fs.existsSync(path.join(agents, "ana-perez.md"))).toBe(true);

  const card = page.locator(".teamcanvas__node", { hasText: "Ana Pérez" });
  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Borrar agente" }).click();
  await page
    .getByRole("dialog", { name: "¿Borrar a Ana Pérez?" })
    .getByRole("button", { name: "Borrar agente" })
    .click();
  await expect(card).toHaveCount(0);
  expect(fs.existsSync(path.join(agents, "ana-perez.md"))).toBe(false);
  expect(fs.readdirSync(path.join(agents, ".archived")).some((f) => f.startsWith("ana-perez-"))).toBe(true);
});

test("in the base project the super-agent is on top and a global agent can report to another one", async ({ page }) => {
  await rpc("setup.finish", {});
  const lead = await rpc<{ id: string }>("agents.create", { slug: "northwind-ops", name: "Northwind Ops" });
  await rpc("agents.create", { slug: "northwind-desk", name: "Northwind Desk" });
  await open(page, "#project=~default&tab=team");

  const desk = page.locator(".teamcanvas__node", { hasText: "Northwind Desk" });
  await desk.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();
  const detail = page.locator(".teamdetail");
  const parent = detail.getByRole("button", { name: "Reporta a" });
  await expect(parent).toHaveText(/el super-agente \(por defecto\)/);
  await parent.click();
  await page.getByRole("menuitem", { name: "Northwind Ops" }).click();
  await page
    .getByRole("dialog", { name: "¿Cambiar a quién reporta?" })
    .getByRole("button", { name: "Cambiar" })
    .click();
  await expect(parent).toHaveText("Northwind Ops");
  const saved = await rpc<{ agent: { parent?: string } }>("agents.get", { agent: "northwind-desk" });
  expect(saved.agent.parent).toBe(lead.id);

  // The super-agent's detail says it reports to nobody.
  await page.locator(".teamcanvas__node:has(.apx-agentnode.is-lead)").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();
  await expect(detail.getByText("A nadie: es el super-agente, arriba de todos.")).toBeVisible();

  // Its autonomy is the owner's to set: with none of its own it goes as far as its project; total acts without asking.
  const autonomy = detail.getByRole("button", { name: "Modo de permisos" });
  const fromProject = "Del proyecto: Auto: pregunta solo lo fuerte";
  await expect(autonomy).toHaveText(fromProject);
  await autonomy.click();
  await page.getByRole("menuitem", { name: "Total: no pregunta nada" }).click();
  await expect(autonomy).toHaveText("Total: no pregunta nada");
  const own = async () =>
    (await rpc<{ agent: { autonomy?: string } }>("agents.get", { agent: "superagent" })).agent.autonomy;
  expect(await own()).toBe("total");
  await autonomy.click();
  await page.getByRole("menuitem", { name: fromProject }).click();
  await expect(autonomy).toHaveText(fromProject);
  expect(await own()).toBeUndefined();
});

test("an agent model-call limit preserves other budgets and reports a failed save", async ({ page }) => {
  await rpc("setup.finish", {});
  await rpc("agents.set_agent_limits", { agent: "superagent", limits: { runs: 5, tokens: 100_000 } });
  await open(page, "#project=~default&tab=team");

  await page.locator(".teamcanvas__node:has(.apx-agentnode.is-lead)").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();
  const detail = page.locator(".teamdetail");
  const calls = detail.getByLabel("Llamadas al modelo por ejecución");
  const own = async () => (await rpc<{ agents: Record<string, object> }>("agents.limits")).agents.superagent;
  await expect(detail.getByLabel("Turnos sin vos")).toHaveValue("5");
  await rpc("agents.set_agent_limits", { agent: "superagent", limits: { runs: 6, tokens: 100_000 } });
  await calls.fill("25");
  await calls.blur();
  await expect.poll(own).toEqual({ runs: 6, tokens: 100_000, steps: 25 });

  await page.route("**/rpc/agents.set_agent_limits", (route) =>
    route.fulfill({ json: { ok: false, error: { code: "unavailable", message: "Budget save refused" } } }),
  );
  await calls.fill("10");
  await calls.blur();
  await expect(detail.getByRole("alert")).toContainText("Budget save refused");
  await expect(calls).toHaveValue("25");
  expect(await own()).toEqual({ runs: 6, tokens: 100_000, steps: 25 });

  await page.unroute("**/rpc/agents.set_agent_limits");
  await calls.fill("");
  await calls.blur();
  await expect.poll(own).toEqual({ runs: 6, tokens: 100_000, steps: 0 });
});

test("an agent limit load failure is visible", async ({ page }) => {
  await rpc("setup.finish", {});
  await open(page, "#project=~default&tab=team");
  await page.route("**/rpc/agents.limits", (route) =>
    route.fulfill({ json: { ok: false, error: { code: "unavailable", message: "Budget load refused" } } }),
  );
  await page.locator(".teamcanvas__node:has(.apx-agentnode.is-lead)").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();
  await expect(page.locator(".teamdetail").getByRole("alert")).toContainText("Budget load refused");
});

test("an agent model-call limit saved in the editor refreshes its detail", async ({ page }) => {
  await rpc("setup.finish", {});
  await rpc("agents.set_agent_limits", { agent: "superagent", limits: { steps: 12 }, merge: false });
  await open(page, "#project=~default&tab=team");
  await page.locator(".teamcanvas__node:has(.apx-agentnode.is-lead)").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();
  const detail = page.locator(".teamdetail");
  const detailCalls = detail.getByLabel("Llamadas al modelo por ejecución");
  await expect(detailCalls).toHaveValue("12");
  await detail.getByRole("button", { name: "Editar agente" }).click();
  const editor = page.getByRole("dialog", { name: "Editar super-agente" });
  await editor.getByRole("button", { name: /^Modo de permisos/ }).click();
  const editorCalls = editor.getByLabel("Llamadas al modelo por ejecución");
  await expect(editorCalls).toHaveValue("12");
  await editorCalls.fill("25");
  await editorCalls.blur();
  await expect(editorCalls).toBeEnabled();
  await expect
    .poll(
      async () => (await rpc<{ agents: Record<string, { steps?: number }> }>("agents.limits")).agents.superagent?.steps,
    )
    .toBe(25);
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(detailCalls).toHaveValue("25");
});

test("invalid model-call limits cannot silently clear an existing cap", async ({ page }) => {
  await rpc("setup.finish", {});
  await rpc("agents.set_agent_limits", { agent: "superagent", limits: { steps: 25 }, merge: false });
  await open(page, "#project=~default&tab=team");
  await page.locator(".teamcanvas__node:has(.apx-agentnode.is-lead)").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();
  const detail = page.locator(".teamdetail");
  const input = detail.getByLabel("Llamadas al modelo por ejecución");
  for (const invalid of ["-1", "1.5", "151"]) {
    await input.fill(invalid);
    await input.blur();
    await expect(detail.getByRole("alert")).toContainText("número entero");
    const limits = await rpc<{ agents: Record<string, { steps?: number }> }>("agents.limits");
    expect(limits.agents.superagent?.steps).toBe(25);
  }
  await input.fill("15");
  await input.blur();
  await expect
    .poll(
      async () => (await rpc<{ agents: Record<string, { steps?: number }> }>("agents.limits")).agents.superagent?.steps,
    )
    .toBe(15);
  await expect(detail.getByRole("alert")).toHaveCount(0);
  await input.fill("150");
  await input.blur();
  await expect
    .poll(
      async () => (await rpc<{ agents: Record<string, { steps?: number }> }>("agents.limits")).agents.superagent?.steps,
    )
    .toBe(150);
  await input.fill("0");
  await input.blur();
  await expect
    .poll(
      async () => (await rpc<{ agents: Record<string, { steps?: number }> }>("agents.limits")).agents.superagent?.steps,
    )
    .toBeUndefined();
  await expect(input).toHaveValue("");
});

test("incomplete number inputs cannot silently clear an existing model-call cap", async ({ page }) => {
  await rpc("setup.finish", {});
  await rpc("agents.set_agent_limits", { agent: "superagent", limits: { steps: 25 }, merge: false });
  await open(page, "#project=~default&tab=team");
  await page.locator(".teamcanvas__node:has(.apx-agentnode.is-lead)").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();
  const detail = page.locator(".teamdetail");
  const input = detail.getByLabel("Llamadas al modelo por ejecución");
  for (const partial of ["-", "1e", "."]) {
    await input.fill("");
    await input.pressSequentially(partial);
    expect(await input.evaluate((element: HTMLInputElement) => element.validity.badInput)).toBe(true);
    await input.blur();
    await expect(detail.getByRole("alert")).toContainText("número entero");
    const limits = await rpc<{ agents: Record<string, { steps?: number }> }>("agents.limits");
    expect(limits.agents.superagent?.steps).toBe(25);
    await input.fill("25");
    await input.blur();
    await expect(detail.getByRole("alert")).toHaveCount(0);
    await expect(input).toBeEnabled();
  }
});

test("pending agent limit saves block duplicates and do not overwrite a different agent", async ({ page }) => {
  await rpc("setup.finish", {});
  await rpc("agents.set_agent_limits", { agent: "superagent", limits: null, merge: false });
  reviewer = (await rpc<{ id: string }>("agents.create", { slug: "northwind-reviewer", name: "Northwind Reviewer" }))
    .id;
  await rpc("agents.set_agent_limits", { agent: "northwind-reviewer", limits: { steps: 7 }, merge: false });
  await open(page, "#project=~default&tab=team");
  await page.locator(".teamcanvas__node:has(.apx-agentnode.is-lead)").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Ver detalle" }).click();

  let release = () => {};
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = () => {};
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  let requests = 0;
  await page.route("**/rpc/agents.set_agent_limits", async (route) => {
    requests++;
    started();
    await blocked;
    await route.continue();
  });
  const detail = page.locator(".teamdetail");
  const calls = detail.getByLabel("Llamadas al modelo por ejecución");
  try {
    await calls.fill("25");
    await calls.press("Enter");
    await requested;
    await expect(calls).toBeDisabled();
    await expect(detail.getByLabel("Turnos sin vos")).toBeDisabled();
    await page.locator(".teamcanvas__node", { hasText: "Northwind Reviewer" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Ver detalle" }).click();
    await expect(calls).toHaveValue("7");
  } finally {
    release();
  }
  await expect
    .poll(
      async () => (await rpc<{ agents: Record<string, { steps?: number }> }>("agents.limits")).agents.superagent?.steps,
    )
    .toBe(25);
  await expect(calls).toHaveValue("7");
  expect(requests).toBe(1);
});
