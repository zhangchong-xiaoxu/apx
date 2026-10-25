// What APX itself writes on a channel (not the agent's words), in the owner's language.
import { textLanguage } from "../domain/owner.ts";
import type { Store } from "../domain/store.ts";

const es = {
  pairing: (name: string, agent: string, code: string, label: string) =>
    `Hola ${name}. Soy ${agent}, un asistente. Todavía no conozco este chat: hay que aprobarlo con el código ${code}. Si sos mi dueño, en APX › ${label} tocá "Soy yo" y escribilo.`,
  pairingOwner: (name: string, label: string, code: string) =>
    `${name} quiere hablar por ${label}. Código ${code}. Aprobalo acá o en APX › Canales.`,
  pairingApp: (name: string, label: string, code: string) =>
    `${name} quiere hablar por ${label} (código ${code}). Aprobalo en la lista de ${label}.`,
  askOwner: (name: string, label: string, text: string) =>
    `${name} te escribió por ${label}${text ? `: «${text}»` : "."} ¿Le contesto?`,
  wroteFirst: (name: string, label: string, text: string) =>
    `${name} te escribió por ${label}${text ? `: «${text}»` : "."} No le contesto: quedó como contacto sin revisar.`,
  answering: (name: string, label: string) => `${name} te escribió por ${label}: le contesto como contacto nuevo.`,
  answer: "Contestarle",
  willAnswer: (name: string) => `Listo: a partir de ahora le contesto a ${name}.`,
  keptQuiet: (name: string) => `Listo: ${name} queda silenciado y no te aviso más de sus mensajes.`,
  approved: "Aprobado.",
  denied: "Rechazado.",
  answered: (a: string) => `Respondido: ${a}`,
  approve: "Permitir",
  deny: "No",
  send: "Enviar",
  skip: "Omitir",
  skipped: "(omitida)",
  pickSome: "Tildá al menos una opción, o tocá Omitir.",
  cut: (more: number) => `(cortado: ${more} caracteres más, miralos en APX antes de aprobar)`,
  asContact: "Aprobar como contacto",
  ignore: "Ignorar",
  failed: (why: string) => `No pude terminar: ${why}`,
  contactFailed: "Ahora no puedo responder; ya le avisé a mi dueño.",
  contactFailedOwner: (name: string, why: string) => `No pude responderle a ${name}: ${why}`,
  passedOn: (name: string, kind: string, summary: string, rest: string) =>
    `${name} ${kind === "appointment" ? "pidió un turno" : kind === "message" ? "te dejó un mensaje" : "te pidió algo"}: ${summary}${rest ? `\n${rest}` : ""}\nQuedó en tus tareas.`,
  reactFailed: (emoji: string, where: string) =>
    `No pude reaccionar con ${emoji} en ${where}: no hay un mensaje suyo al que reaccionar o el canal no tiene reacciones. No se envió nada.`,
  reactRefused: (emoji: string, where: string, why: string) =>
    `No pude reaccionar con ${emoji} en ${where}: la plataforma rechazó la reacción (${why}). No se envió nada.`,
  reacted: (emoji: string) => `Reaccionó con ${emoji}`,
  sentSticker: (meaning: string) => (meaning ? `Mandó un sticker: ${meaning}` : "Mandó un sticker"),
  stickerTitle: "Sticker nuevo",
  stickerWaits: (where: string, meaning: string | undefined, adult: boolean) =>
    `Llegó un sticker por ${where}${meaning ? ` («${meaning}»)` : ""}${adult ? " que parece para adultos (+18)" : ""}. No lo uso hasta que lo apruebes en Configuración › Canales › ${where} › Stickers.`,
  stickerMissing: (words: string, where: string) =>
    `No mandé el sticker «${words}» en ${where}: no tengo uno guardado de este canal que diga eso. No se envió nada.`,
  tooMany: (name: string) => `${name} escribe mucho seguido: pausé sus respuestas automáticas por una hora.`,
  roomCap: (room: string) =>
    `Llegué al tope de respuestas por hora en ${room}: sigo leyendo, contesto cuando se libere.`,
  roomFailed: (room: string, why: string) => `No pude responder en ${room}: ${why}`,
  notHandled: (name: string, why: string) => `No pude procesar un mensaje de ${name}: ${why}`,
  buttonFailed: (why: string) => `No pude hacerlo: ${why}`,
  goOn: "Continuar",
  wentOn: "Listo, sigue trabajando.",
  goOnPrompt:
    "Continuá el trabajo pendiente en esta sesión desde el último informe. Conservá el alcance y los permisos existentes; informá el resultado a quien te delegó.",
  stopped: "Listo, paré.",
  due: (title: string, person?: string, owedBy?: "owner" | "person") =>
    person
      ? owedBy === "person"
        ? `Vence: ${title}. Te lo debe ${person}.`
        : `Vence: ${title}. Se lo debés a ${person}.`
      : `Vence: ${title}.`,
  routineFailed: (name: string, why: string) => `La rutina «${name}» no pudo terminar: ${why}`,
  providerLimitTitle: "Límite del proveedor de modelos",
  providerLimit: (until?: string) =>
    until
      ? `El proveedor de modelos llegó a su límite de uso: los agentes quedan frenados hasta las ${until}.`
      : "El proveedor de modelos llegó a su límite de uso: los agentes quedan frenados y no dijo hasta cuándo.",
  noticeLostTitle: "Un aviso no te llegó",
  noticeLost: (channels: string, why: string, text: string) =>
    `Ningún canal pudo entregarlo (${channels}${why ? `: ${why}` : ""}). Decía: «${text}»`,
  reminders: (lines: string[]) => `Recordatorios:\n${lines.map((l) => `• ${l}`).join("\n")}`,
  digest: (texts: string[]) => `Mientras estabas en silencio:\n\n${texts.join("\n\n—\n\n")}`,
  suggested: (name: string, label: string, said: string, draft: string) =>
    `${name} te escribió por ${label}:\n${said}\n\nLe contestaría:\n«${draft}»`,
  noSuggestion: (name: string, label: string, said: string, why: string) =>
    `${name} te escribió por ${label}:\n${said}\n\nNo te sugiero respuesta: ${why}`,
  nothingToAnswer: "parece que no hace falta contestar.",
  quote: (text: string) => `«${text}»`,
  sendThis: "Mandar esta",
  writeMyself: "Contestar yo",
  suggestionSent: (name: string) => `Listo: se lo mandé a ${name}.`,
  suggestionNotSent: (name: string, why: string) => `No le llegó a ${name}: ${why}`,
  suggestionDropped: (name: string) => `Listo: no le contesto a ${name}.`,
  suggestionGone: "Esa sugerencia ya no está pendiente (ya se decidió o llegó un mensaje más nuevo).",
  inputGone: "Eso ya no está pendiente: se respondió en otro lado o venció.",
  inApp: "Esto se responde en la app de APX (el panel, el escritorio o tu teléfono vinculado), no por este canal.",
  writeNow: (name: string, minutes: number) =>
    `Escribí tu respuesta para ${name}: lo próximo que me mandes acá se lo envío tal cual (durante ${minutes} minutos). Mandá «cancelar» para no enviarle nada.`,
  writeCanceled: "Listo, no le mando nada.",
  tooManyDrafts: (name: string) =>
    `${name} escribe mucho seguido: por esta hora no te sugiero más respuestas. Sus mensajes quedan en su chat.`,
};

const en: typeof es = {
  pairing: (name, agent, code, label) =>
    `Hi ${name}. I'm ${agent}, an assistant. I don't know this chat yet: it has to be approved with the code ${code}. If you are my owner, tap "It's me" in APX › ${label} and type it.`,
  pairingOwner: (name, label, code) =>
    `${name} wants to talk on ${label}. Code ${code}. Approve it here or in APX › Channels.`,
  pairingApp: (name, label, code) =>
    `${name} wants to talk on ${label} (code ${code}). Approve it in the ${label} list.`,
  askOwner: (name, label, text) => `${name} wrote to you on ${label}${text ? `: "${text}"` : "."} Shall I answer?`,
  answering: (name, label) => `${name} wrote to you on ${label}: I'm answering them as a new contact.`,
  wroteFirst: (name, label, text) =>
    `${name} wrote to you on ${label}${text ? `: "${text}"` : "."} I'm not answering: they're kept as an unreviewed contact.`,
  answer: "Answer them",
  willAnswer: (name) => `Done: from now on I answer ${name}.`,
  keptQuiet: (name) => `Done: ${name} stays silenced and I won't report their messages anymore.`,
  approved: "Approved.",
  denied: "Denied.",
  answered: (a) => `Answered: ${a}`,
  approve: "Allow",
  deny: "No",
  send: "Send",
  skip: "Skip",
  skipped: "(skipped)",
  pickSome: "Tick at least one option, or tap Skip.",
  cut: (more) => `(cut: ${more} more characters, see them in APX before approving)`,
  asContact: "Approve as contact",
  ignore: "Ignore",
  failed: (why) => `I couldn't finish: ${why}`,
  contactFailed: "I can't answer right now; I've let my owner know.",
  contactFailedOwner: (name, why) => `I couldn't answer ${name}: ${why}`,
  passedOn: (name, kind, summary, rest) =>
    `${name} ${kind === "appointment" ? "asked for an appointment" : kind === "message" ? "left you a message" : "asked you for something"}: ${summary}${rest ? `\n${rest}` : ""}\nIt's in your tasks.`,
  reactFailed: (emoji, where) =>
    `I couldn't react with ${emoji} in ${where}: there is no message of theirs to react to, or the channel has no reactions. Nothing was sent.`,
  reactRefused: (emoji, where, why) =>
    `I couldn't react with ${emoji} in ${where}: the platform refused the reaction (${why}). Nothing was sent.`,
  reacted: (emoji) => `Reacted with ${emoji}`,
  sentSticker: (meaning) => (meaning ? `Sent a sticker: ${meaning}` : "Sent a sticker"),
  stickerTitle: "New sticker",
  stickerWaits: (where, meaning, adult) =>
    `A sticker arrived on ${where}${meaning ? ` ("${meaning}")` : ""}${adult ? " that looks adults-only (18+)" : ""}. I won't use it until you approve it in Settings › Channels › ${where} › Stickers.`,
  stickerMissing: (words, where) =>
    `I didn't send the sticker "${words}" in ${where}: I have none kept from this channel that says that. Nothing was sent.`,
  tooMany: (name) => `${name} is writing a lot in a row: I paused their automatic answers for an hour.`,
  roomCap: (room) => `I hit the hourly cap of answers in ${room}: I keep reading and answer once it frees up.`,
  roomFailed: (room, why) => `I couldn't answer in ${room}: ${why}`,
  notHandled: (name, why) => `I couldn't handle a message from ${name}: ${why}`,
  buttonFailed: (why) => `I couldn't do it: ${why}`,
  goOn: "Continue",
  wentOn: "Done, it is working again.",
  goOnPrompt:
    "Continue the remaining work in this session from the last progress report. Keep the existing scope and permissions; report the result to the original caller.",
  stopped: "Done, I stopped.",
  due: (title, person, owedBy) =>
    person
      ? owedBy === "person"
        ? `Due: ${title}. ${person} owes it to you.`
        : `Due: ${title}. You owe it to ${person}.`
      : `Due: ${title}.`,
  routineFailed: (name, why) => `The routine "${name}" couldn't finish: ${why}`,
  providerLimitTitle: "Model provider limit",
  providerLimit: (until) =>
    until
      ? `The model provider's usage limit was reached: agents are stopped until ${until}.`
      : "The model provider's usage limit was reached: agents are stopped, and it did not say until when.",
  noticeLostTitle: "A notice didn't reach you",
  noticeLost: (channels, why, text) =>
    `No channel could deliver it (${channels}${why ? `: ${why}` : ""}). It said: "${text}"`,
  reminders: (lines) => `Reminders:\n${lines.map((l) => `• ${l}`).join("\n")}`,
  digest: (texts) => `While your quiet hours lasted:\n\n${texts.join("\n\n—\n\n")}`,
  suggested: (name, label, said, draft) => `${name} wrote to you on ${label}:\n${said}\n\nI'd answer:\n"${draft}"`,
  noSuggestion: (name, label, said, why) => `${name} wrote to you on ${label}:\n${said}\n\nNo suggested answer: ${why}`,
  nothingToAnswer: "it seems to need no answer.",
  quote: (text) => `"${text}"`,
  sendThis: "Send this",
  writeMyself: "I'll answer",
  suggestionSent: (name) => `Done: sent to ${name}.`,
  suggestionNotSent: (name, why) => `It didn't reach ${name}: ${why}`,
  suggestionDropped: (name) => `Done: I won't answer ${name}.`,
  suggestionGone: "That suggestion is no longer pending (it was decided, or a newer message came in).",
  inputGone: "That is no longer pending: it was answered elsewhere or it expired.",
  inApp: "Answer this in the APX app (the panel, the desktop or your paired phone), not on this channel.",
  writeNow: (name, minutes) =>
    `Write your answer for ${name}: the next thing you send me here goes to them as it is (for ${minutes} minutes). Send "cancel" to send nothing.`,
  writeCanceled: "Done, I'm sending nothing.",
  tooManyDrafts: (name) =>
    `${name} is writing a lot in a row: no more suggested answers this hour. Their messages stay in their chat.`,
};

export type ChannelTexts = typeof es;

const zh: ChannelTexts = {
  pairing: (name, agent, code, label) =>
    `你好 ${name}。我是 ${agent}，一个助手。我还不认识这个对话：需要用代码 ${code} 批准。如果你是我的主人，请在 APX › ${label} 中点击“是我本人”并输入它。`,
  pairingOwner: (name, label, code) => `${name} 想通过 ${label} 与你交谈。代码 ${code}。请在这里或 APX › 渠道 中批准。`,
  pairingApp: (name, label, code) => `${name} 想通过 ${label} 与你交谈（代码 ${code}）。请在 ${label} 列表中批准。`,
  askOwner: (name, label, text) => `${name} 通过 ${label} 给你发了消息${text ? `：“${text}”` : "。"}要我回复吗？`,
  wroteFirst: (name, label, text) =>
    `${name} 通过 ${label} 给你发了消息${text ? `：“${text}”` : "。"}我不会回复：对方被记为未审核的联系人。`,
  answering: (name, label) => `${name} 通过 ${label} 给你发了消息：我会把对方当作新联系人来回复。`,
  answer: "回复对方",
  willAnswer: (name) => `好的：从现在起我会回复 ${name}。`,
  keptQuiet: (name) => `好的：${name} 保持静音，我不再向你汇报对方的消息。`,
  approved: "已批准。",
  denied: "已拒绝。",
  answered: (a) => `已回答：${a}`,
  approve: "允许",
  deny: "不允许",
  send: "发送",
  skip: "跳过",
  skipped: "（已跳过）",
  pickSome: "请至少勾选一个选项，或点击跳过。",
  cut: (more) => `（已截断：还有 ${more} 个字符，批准前请在 APX 中查看）`,
  asContact: "批准为联系人",
  ignore: "忽略",
  failed: (why) => `我无法完成：${why}`,
  contactFailed: "我现在无法回复；已通知我的主人。",
  contactFailedOwner: (name, why) => `我无法回复 ${name}：${why}`,
  passedOn: (name, kind, summary, rest) =>
    `${name} ${kind === "appointment" ? "想约个时间" : kind === "message" ? "给你留了言" : "有事请你帮忙"}：${summary}${rest ? `\n${rest}` : ""}\n已放进你的任务。`,
  reactFailed: (emoji, where) =>
    `我无法在 ${where} 用 ${emoji} 做出反应：没有对方的消息可以反应，或该渠道不支持反应。没有发送任何内容。`,
  reactRefused: (emoji, where, why) =>
    `我无法在 ${where} 用 ${emoji} 做出反应：平台拒绝了该反应（${why}）。没有发送任何内容。`,
  reacted: (emoji) => `已用 ${emoji} 做出反应`,
  sentSticker: (meaning) => (meaning ? `发送了一个贴纸：${meaning}` : "发送了一个贴纸"),
  stickerTitle: "新贴纸",
  stickerWaits: (where, meaning, adult) =>
    `${where} 收到一个贴纸${meaning ? `（“${meaning}”）` : ""}${adult ? "，看起来仅限成人（18+）" : ""}。在你于 设置 › 渠道 › ${where} › 贴纸 中批准之前，我不会使用它。`,
  stickerMissing: (words, where) =>
    `我没有在 ${where} 发送贴纸“${words}”：这个渠道里没有保存表达这个意思的贴纸。没有发送任何内容。`,
  tooMany: (name) => `${name} 连续发了太多消息：我已将对其的自动回复暂停一小时。`,
  roomCap: (room) => `我在 ${room} 的每小时回复数已达上限：我会继续阅读，等恢复后再回复。`,
  roomFailed: (room, why) => `我无法在 ${room} 中回复：${why}`,
  notHandled: (name, why) => `我无法处理 ${name} 的一条消息：${why}`,
  buttonFailed: (why) => `我无法完成：${why}`,
  goOn: "继续",
  wentOn: "好的，它又开始工作了。",
  goOnPrompt: "从上次进度报告继续完成此对话中的剩余工作。保持现有范围和权限，并将结果报告给原调用方。",
  stopped: "好的，我停下了。",
  due: (title, person, owedBy) =>
    person
      ? owedBy === "person"
        ? `到期：${title}。${person} 欠你的。`
        : `到期：${title}。你欠 ${person} 的。`
      : `到期：${title}。`,
  routineFailed: (name, why) => `自动任务“${name}”未能完成：${why}`,
  providerLimitTitle: "模型提供方限制",
  providerLimit: (until) =>
    until
      ? `模型提供方的用量已达上限：智能体将暂停到 ${until}。`
      : "模型提供方的用量已达上限：智能体已暂停，且对方未说明恢复时间。",
  noticeLostTitle: "有一条通知没有送达你",
  noticeLost: (channels, why, text) => `没有任何渠道能送达它（${channels}${why ? `：${why}` : ""}）。内容是：“${text}”`,
  reminders: (lines) => `提醒：\n${lines.map((l) => `• ${l}`).join("\n")}`,
  digest: (texts) => `免打扰期间的内容：\n\n${texts.join("\n\n—\n\n")}`,
  suggested: (name, label, said, draft) =>
    `${name} 通过 ${label} 给你发了消息：\n${said}\n\n我会这样回复：\n“${draft}”`,
  noSuggestion: (name, label, said, why) => `${name} 通过 ${label} 给你发了消息：\n${said}\n\n没有建议的回复：${why}`,
  nothingToAnswer: "似乎不需要回复。",
  quote: (text) => `“${text}”`,
  sendThis: "发送这条",
  writeMyself: "我来回复",
  suggestionSent: (name) => `好的：已发送给 ${name}。`,
  suggestionNotSent: (name, why) => `没有送达 ${name}：${why}`,
  suggestionDropped: (name) => `好的：我不会回复 ${name}。`,
  suggestionGone: "这条建议已不在待处理状态（已经决定，或收到了更新的消息）。",
  inputGone: "这个已不在待处理状态：已在其他地方回答，或已过期。",
  inApp: "请在 APX 应用（面板、桌面端或已配对的手机）里回答，而不是在这个渠道里。",
  writeNow: (name, minutes) =>
    `请写下你给 ${name} 的回复：你在这里发给我的下一条内容会原样发送给对方（${minutes} 分钟内）。发送“取消”则不发送任何内容。`,
  writeCanceled: "好的，什么都不发送。",
  tooManyDrafts: (name) => `${name} 连续发了太多消息：这个小时不再为你建议回复。对方的消息仍留在其对话中。`,
};

export const channelTexts = (store: Store): ChannelTexts => ({ en, es, zh })[textLanguage(store)];
