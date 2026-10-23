// An action card's title in the owner's language. Tools write theirs in English; these are the Spanish and Chinese ones.
import { textLanguage } from "../domain/owner.ts";
import type { Store } from "../domain/store.ts";
import { stepsText } from "../tools/computer.ts";
import type { Tool } from "../tools/types.ts";

type Args = Record<string, unknown>;

const str = (v: unknown, max = 80) => String(v ?? "").slice(0, max);
const file = (path: unknown, fallback: string) => (path ? String(path).split(/[\\/]/).at(-1) : fallback);
const host = (url: unknown) => {
  try {
    return new URL(String(url)).host;
  } catch {
    return String(url ?? "");
  }
};
const TASK_STATE: Record<string, string> = {
  open: "abierta",
  done: "hecha",
  dropped: "descartada",
  kept: "cumplida",
  missed: "incumplida",
  renegotiated: "renegociada",
};

/** Spanish titles for the built-in tools, by tool name. */
export const SPANISH_TITLES: Record<string, (a: Args) => string> = {
  video_transcript: (a) => `Miró ${str(a.url)}`,
  pass_request: (a) =>
    `${a.task === undefined ? "Revisó pedidos" : a.task ? "Actualizó pedido" : "Pasó el pedido"}: ${str(a.summary)}`,
  search_owner_notes: (a) => `Buscó «${str(a.query, 60)}» en tus notas`,
  contact_requests: () => "Revisó quién está esperando",
  answer_contact_request: (a) => (a.decision === "answer" ? `Dejó pasar a ${str(a.code)}` : `Ignoró a ${str(a.code)}`),
  search_chats: (a) => `Buscó «${str(a.query, 60)}» en los chats`,
  read_chat: (a) => `Leyó el chat ${str(a.chat)}`,
  channel_list: () => "Revisó los canales",
  routine_list: (a) => (a.routine ? `Revisó la rutina ${str(a.routine)}` : "Revisó las rutinas"),
  routine_set: (a) => (a.routine ? `Cambió la rutina ${str(a.routine)}` : `Creó la rutina ${str(a.name)}`),
  agent_limits: (a) =>
    a.go_on
      ? "Dejó seguir a los agentes"
      : a.runs !== undefined || a.tokens !== undefined
        ? "Cambió los límites de los agentes"
        : "Revisó los límites de los agentes",
  contact_list: () => "Revisó los contactos",
  list_agents: () => "Buscó agentes",
  agent_set: (a) =>
    !a.agent
      ? `Creó el agente ${str(a.name ?? a.slug)}${a.project ? ` en ${str(a.project)}` : ""}`
      : a.archive
        ? `Archivó a ${str(a.agent)}`
        : [a.slug, a.name, a.role, a.description, a.prompt, a.personality, a.parent].some((v) => v !== undefined)
          ? `Cambió a ${str(a.agent)}`
          : `Miró a ${str(a.agent)}`,
  grant_tool: (a) =>
    `Dejó que ${str(a.agent ?? "un agente")} use ${(Array.isArray(a.tools) ? a.tools : []).join(", ").slice(0, 60)}`,
  delegate: (a) => {
    const worker = a.worker as { name?: unknown } | undefined;
    return `Le pidió a ${str(worker?.name ?? a.agent ?? a.session)}`;
  },
  list_sessions: () => "Buscó sesiones",
  stop_session: (a) => `Detuvo la sesión ${str(a.session)}`,
  browser_open: (a) => `Abrió ${host(a.url)}`,
  browser_snapshot: () => "Leyó la página",
  browser_text: () => "Leyó el texto",
  browser_click: (a) => `Hizo clic en ${str(a.ref)}`,
  browser_type: (a) => `Escribió en ${str(a.ref)}`,
  browser_use_my_login: (a) => `Usó tu sesión en ${str(a.domain)}`,
  browser_handoff: (a) => `Te pidió: ${str(a.reason, 60)}`,
  message_contact: (a) => `Le escribió a ${str(a.to ?? "un contacto")}`,
  channel_post: (a) => (a.room ? `Publicó en #${str(a.room).replace(/^#/, "")}` : "Publicó en una sala"),
  open_document: (a) => `Abrió el documento ${a.title ? str(a.title) : file(a.path, "")}`,
  shell: (a) => `Ejecutó ${str(a.command, 60)}`,
  shell_output: () => "Leyó la salida de un proceso",
  shell_kill: () => "Detuvo un proceso",
  imessage_read: (a) => (a.with ? `Leyó los iMessages con ${str(a.with)}` : "Leyó los últimos iMessages"),
  imessage_send: (a) => `Envió un iMessage a ${str(a.to ?? "alguien")}`,
  remember: (a) => `Recordó: ${str(a.text)}`,
  recall: (a) => `Buscó «${str(a.query, 60)}» en la memoria`,
  forget: (a) => `Olvidó la nota ${str(a.id)}`,
  show_widget: (a) => `Hizo el widget ${str(a.title ?? a.name)}`,
  read_widget: (a) => (a.name ? `Leyó el widget ${str(a.name)}` : "Listó los widgets"),
  edit_widget: (a) => `Editó el widget ${str(a.name)}`,
  web_search: (a) => `Buscó ${str(a.query)}`,
  web_read: (a) => (a.url ? `Leyó ${host(a.url)}` : "Leyó una página"),
  phone_location: () => "Vio dónde está tu teléfono",
  phone_photo: () => "Pidió una foto a tu teléfono",
  screen_snapshot: (a) => (a.app ? `Miró ${str(a.app)} en tu pantalla` : "Miró tu pantalla"),
  screen_click: (a) => `Hizo clic en ${str(a.app) || "una app"}`,
  screen_type: (a) => `Escribió en ${str(a.app) || "una app"}`,
  screen_key: (a) => `Apretó ${str(a.keys)} en ${str(a.app) || "una app"}`,
  screen_do: (a) =>
    `En ${str(a.app) || "una app"}: ${stepsText(a.steps)
      .replace(/\bclick\b/g, "clic")
      .replace(/\btype\b/g, "escribir")}`.slice(0, 160),
  screen_open: (a) => `Abrió ${str(a.url ?? a.app)}${a.url && a.app ? ` en ${str(a.app)}` : ""}`,
  task_get: () => "Consultó una tarea",
  task_list: () => "Revisó las tareas",
  task_create: (a) => `Creó la tarea ${str(a.title, 60)}`,
  task_update: (a) => `Actualizó la tarea ${str(a.task)}`,
  task_comment: (a) => `Comentó en ${str(a.task)}`,
  task_close: (a) => `Marcó ${str(a.task)} como ${TASK_STATE[str(a.state)] ?? str(a.state)}`,
  commitment_settle: (a) => `Marcó ${str(a.task)} como ${TASK_STATE[str(a.outcome)] ?? str(a.outcome)}`,
  send_file: (a) => `Adjuntó ${file(a.path, "un archivo")}`,
  voice_replies: (a) => (a.on ? "Activó las respuestas habladas" : "Desactivó las respuestas habladas"),
  make_image: (a) => `Dibujó: ${str(a.prompt)}`,
  ask_owner: (a) => `Te preguntó: ${str(a.question, 60)}`,
  notify_owner: (a) => `Te avisó: ${str(a.text, 60)}`,
  read_output: () => "Leyó más de una salida",
  load_skill: (a) =>
    a.file ? `Leyó ${file(a.file, "")} de la habilidad ${str(a.name)}` : `Cargó la habilidad ${str(a.name)}`,
  file_read: (a) => `Leyó ${str(a.path ?? "un archivo")}`,
  file_write: (a) => `Escribió ${str(a.path ?? "un archivo")}`,
  file_edit: (a) => `Editó ${str(a.path ?? "un archivo")}`,
};

const ZH_TASK_STATE: Record<string, string> = {
  open: "未完成",
  done: "已完成",
  dropped: "已放弃",
  kept: "已履行",
  missed: "未履行",
  renegotiated: "已改期",
};

/** Chinese titles for the built-in tools, by tool name. */
export const CHINESE_TITLES: Record<string, (a: Args) => string> = {
  video_transcript: (a) => `观看了 ${str(a.url)}`,
  pass_request: (a) =>
    `${a.task === undefined ? "查看了请求" : a.task ? "更新了请求" : "转交了请求"}：${str(a.summary)}`,
  search_owner_notes: (a) => `在你的笔记中搜索了“${str(a.query, 60)}”`,
  contact_requests: () => "查看了谁在等待",
  answer_contact_request: (a) => (a.decision === "answer" ? `放行了 ${str(a.code)}` : `忽略了 ${str(a.code)}`),
  search_chats: (a) => `在对话中搜索了“${str(a.query, 60)}”`,
  read_chat: (a) => `阅读了对话 ${str(a.chat)}`,
  channel_list: () => "查看了渠道",
  routine_list: (a) => (a.routine ? `查看了自动任务 ${str(a.routine)}` : "查看了自动任务"),
  routine_set: (a) => (a.routine ? `修改了自动任务 ${str(a.routine)}` : `创建了自动任务 ${str(a.name)}`),
  agent_limits: (a) =>
    a.go_on
      ? "让智能体继续"
      : a.runs !== undefined || a.tokens !== undefined
        ? "修改了智能体的限制"
        : "查看了智能体的限制",
  contact_list: () => "查看了联系人",
  list_agents: () => "查找了智能体",
  agent_set: (a) =>
    !a.agent
      ? `创建了智能体 ${str(a.name ?? a.slug)}${a.project ? `（在 ${str(a.project)}）` : ""}`
      : a.archive
        ? `归档了 ${str(a.agent)}`
        : [a.slug, a.name, a.role, a.description, a.prompt, a.personality, a.parent].some((v) => v !== undefined)
          ? `修改了 ${str(a.agent)}`
          : `查看了 ${str(a.agent)}`,
  grant_tool: (a) =>
    `允许 ${str(a.agent ?? "某个智能体")} 使用 ${(Array.isArray(a.tools) ? a.tools : []).join(", ").slice(0, 60)}`,
  delegate: (a) => {
    const worker = a.worker as { name?: unknown } | undefined;
    return `委派给了 ${str(worker?.name ?? a.agent ?? a.session)}`;
  },
  list_sessions: () => "查找了会话",
  stop_session: (a) => `停止了会话 ${str(a.session)}`,
  browser_open: (a) => `打开了 ${host(a.url)}`,
  browser_navigate: (a) => `前往 ${host(a.url)}`,
  browser_snapshot: () => "阅读了页面",
  browser_text: () => "阅读了文本",
  browser_click: (a) => `点击了 ${str(a.ref)}`,
  browser_type: (a) => `在 ${str(a.ref)} 中输入了内容`,
  browser_use_my_login: (a) => `使用了你在 ${str(a.domain)} 的登录状态`,
  browser_handoff: (a) => `请你处理：${str(a.reason, 60)}`,
  message_contact: (a) => `给 ${str(a.to ?? "某个联系人")} 发了消息`,
  channel_post: (a) => (a.room ? `发布到 #${str(a.room).replace(/^#/, "")}` : "发布到某个房间"),
  open_document: (a) => `打开了文档 ${a.title ? str(a.title) : file(a.path, "")}`,
  shell: (a) => `运行了 ${str(a.command, 60)}`,
  shell_output: () => "读取了进程的输出",
  shell_kill: () => "停止了一个进程",
  imessage_read: (a) => (a.with ? `读取了与 ${str(a.with)} 的 iMessage` : "读取了最近的 iMessage"),
  imessage_send: (a) => `给 ${str(a.to ?? "某人")} 发了 iMessage`,
  remember: (a) => `记住了：${str(a.text)}`,
  recall: (a) => `在记忆中搜索了“${str(a.query, 60)}”`,
  forget: (a) => `忘记了笔记 ${str(a.id)}`,
  show_widget: (a) => `制作了小组件 ${str(a.title ?? a.name)}`,
  read_widget: (a) => (a.name ? `读取了小组件 ${str(a.name)}` : "列出了小组件"),
  edit_widget: (a) => `编辑了小组件 ${str(a.name)}`,
  web_search: (a) => `搜索了 ${str(a.query)}`,
  web_read: (a) => (a.url ? `阅读了 ${host(a.url)}` : "阅读了一个页面"),
  phone_location: () => "查看了你手机的位置",
  phone_photo: () => "请你的手机拍了一张照片",
  screen_snapshot: (a) => (a.app ? `查看了你屏幕上的 ${str(a.app)}` : "查看了你的屏幕"),
  screen_click: (a) => `在 ${str(a.app) || "某个应用"} 中点击`,
  screen_type: (a) => `在 ${str(a.app) || "某个应用"} 中输入`,
  screen_key: (a) => `在 ${str(a.app) || "某个应用"} 中按下 ${str(a.keys)}`,
  screen_do: (a) =>
    `在 ${str(a.app) || "某个应用"} 中：${stepsText(a.steps)
      .replace(/\bclick\b/g, "点击")
      .replace(/\btype\b/g, "输入")}`.slice(0, 160),
  screen_open: (a) => `打开了 ${str(a.url ?? a.app)}${a.url && a.app ? `（用 ${str(a.app)}）` : ""}`,
  task_get: () => "查询了一个任务",
  task_list: () => "查看了任务",
  task_create: (a) => `创建了任务 ${str(a.title, 60)}`,
  task_update: (a) => `更新了任务 ${str(a.task)}`,
  task_comment: (a) => `评论了 ${str(a.task)}`,
  task_close: (a) => `将 ${str(a.task)} 标记为${ZH_TASK_STATE[str(a.state)] ?? str(a.state)}`,
  commitment_settle: (a) => `将 ${str(a.task)} 标记为${ZH_TASK_STATE[str(a.outcome)] ?? str(a.outcome)}`,
  send_file: (a) => `附上了 ${file(a.path, "一个文件")}`,
  voice_replies: (a) => (a.on ? "开启了语音回复" : "关闭了语音回复"),
  make_image: (a) => `绘制了：${str(a.prompt)}`,
  ask_owner: (a) => `向你提问：${str(a.question, 60)}`,
  notify_owner: (a) => `通知了你：${str(a.text, 60)}`,
  read_output: () => "读取了更多输出",
  load_skill: (a) => `加载了技能 ${str(a.name)}`,
  file_read: (a) => `读取了 ${str(a.path ?? "一个文件")}`,
  file_write: (a) => `写入了 ${str(a.path ?? "一个文件")}`,
  file_edit: (a) => `编辑了 ${str(a.path ?? "一个文件")}`,
};

/** The card title for a call: the tool's own (English) unless the owner reads Spanish or Chinese and there is one. */
export function toolTitle(store: Store, tool: Tool, args: Args): string {
  const lang = textLanguage(store);
  const localized = lang === "en" ? undefined : (lang === "zh" ? CHINESE_TITLES : SPANISH_TITLES)[tool.name];
  if (!localized) return tool.title(args);
  try {
    return localized(args);
  } catch {
    return tool.title(args);
  }
}
