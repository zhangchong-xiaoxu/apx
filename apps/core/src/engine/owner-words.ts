// What APX itself tells the owner about an agent's turn (not the agent's words), in the owner's language.
import { textLanguage } from "../domain/owner.ts";
import type { Store } from "../domain/store.ts";
import type { ConfirmWhy } from "../tools/policy.ts";

const es: Record<ConfirmWhy, (agent: string, tool: string) => string> = {
  untrusted: (a, t) =>
    `${a} quiere usar ${t}. Te pregunto porque en este turno hay contenido de afuera (una web, otro agente o un mensaje).`,
  always: (a, t) => `${a} quiere usar ${t}: es una acción de alto impacto.`,
  needs_ok: (a, t) => `${a} necesita tu OK para usar ${t}.`,
  asks_every: (a, t) => `${a} quiere usar ${t}: pide tu OK antes de cada acción que cambia algo.`,
  rule: (a, t) => `${a} quiere usar ${t}: sus reglas piden tu OK para esta clase de acción.`,
};

const en: typeof es = {
  untrusted: (a, t) =>
    `${a} wants to use ${t}. Asking because content from outside (a web page, another agent or a message) is in this turn.`,
  always: (a, t) => `${a} wants to use ${t}: this is a high-impact action.`,
  needs_ok: (a, t) => `${a} needs your OK to use ${t}.`,
  asks_every: (a, t) => `${a} wants to use ${t}: it asks before every action that changes something.`,
  rule: (a, t) => `${a} wants to use ${t}: its rules ask for your OK on this kind of action.`,
};

const zh: typeof es = {
  untrusted: (a, t) => `${a} 想使用 ${t}。之所以询问，是因为本轮中有来自外部的内容（网页、其他智能体或消息）。`,
  always: (a, t) => `${a} 想使用 ${t}：这是一个影响重大的操作。`,
  needs_ok: (a, t) => `${a} 需要你的同意才能使用 ${t}。`,
  asks_every: (a, t) => `${a} 想使用 ${t}：每次执行会修改内容的操作前都会先询问你。`,
  rule: (a, t) => `${a} 想使用 ${t}：它的规则要求这类操作需得到你的同意。`,
};

/** The question shown when an agent's action waits for the owner. */
export const confirmPrompt = (store: Store, why: ConfirmWhy, agent: string, tool: string) =>
  ({ en, es, zh })[textLanguage(store)][why](agent, tool);

/** The question of a folder card: an agent wants to read folders outside its own, or (`write`) change files there. */
export const folderPrompt = (store: Store, agent: string, folders: string[], write = false) => {
  const where = folders.join(", ");
  const lang = textLanguage(store);
  if (lang === "en")
    return write
      ? `${agent} wants to change files in ${where}, outside its project`
      : `${agent} wants to read ${where}`;
  if (lang === "zh") return write ? `${agent} 想修改项目之外 ${where} 中的文件` : `${agent} 想读取 ${where}`;
  return write ? `${agent} quiere cambiar archivos en ${where}, fuera de su proyecto` : `${agent} quiere leer ${where}`;
};
