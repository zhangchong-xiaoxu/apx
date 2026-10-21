// What the core's notices say, in each language the apps speak: one copy for the web and the phone. A notice carries a
// stable `code` (and `vars`); its `text` is the core's English, kept when there is no translation or it carries details.

export const noticeEn = {
  "notice.run.stepLimit":
    "Ran out of steps for this turn: this is a report of what is done and left, not a final answer.",
  "notice.run.noModel": "No model available: none of the models could answer (out of quota, signed out or down).",
  "notice.run.noModel.limit": "Stopped by the model provider's usage limit, which lifts at {until}.",
  "notice.run.noModel.limitUnknown": "Stopped by the model provider's usage limit (it did not say when it lifts).",
  "notice.routine.shell": "Ran the command.",
  "notice.routine.watch.quiet": "Nothing new to watch: the model was not called.",
  "notice.routine.relay.quiet": "No team news to tell: the model was not called.",
  "notice.routine.pre.ok": "Pre-command: ok",
  "notice.routine.pre.failed": "Pre-command: failed (exit {exit})",
  "notice.routine.pre.timeout": "Pre-command: timed out",
  "notice.routine.post.ok": "Post-command: ok",
  "notice.routine.post.failed": "Post-command: failed (exit {exit})",
  "notice.routine.post.timeout": "Post-command: timed out",
  "notice.routine.skipped": "The model was not called; the pre-command's result did not ask for it.",
  "notice.breaker.paused.runs":
    "Paused: agents started {spent} turns on their own since you last wrote here. {who} finished; write to continue.",
  "notice.breaker.paused.tokens":
    "Paused: agents spent {spent} tokens on their own since you last wrote here. {who} finished; write to continue.",
  "notice.breaker.paused.link": "Change the limit",
  "notice.breaker.held.runs":
    "Paused: agents started {spent} turns on their own since you last wrote here. {who} starts “{task}” once you let them go on.",
  "notice.breaker.held.tokens":
    "Paused: agents spent {spent} tokens on their own since you last wrote here. {who} starts “{task}” once you let them go on.",
  "notice.breaker.held.agentRuns":
    "Paused for {who}: {who} started {spent} turns on its own since you last wrote here, its own limit. It starts “{task}” once you let them go on.",
  "notice.breaker.held.agentTokens":
    "Paused for {who}: {who} spent {spent} tokens on its own since you last wrote here, its own limit. It starts “{task}” once you let them go on.",
  "notice.breaker.held.link": "Change the limit",
  "notice.breaker.reset": "Restart the budget",
  "notice.breaker.release": "Let them finish this round",
  "notice.breaker.wentOn": "Agents went on",
  "notice.delegation.limit.continuedSteps":
    "{who} ran out of steps on “{task}”; APX had it go on once in session {session}. So far: {sofar}",
  "notice.delegation.limit.continuedTime":
    "{who} ran out of time on “{task}”; APX had it go on once in session {session}. So far: {sofar}",
  "notice.delegation.limit.returnedSteps":
    "{who} ran out of steps on “{task}”. {caller} has its report and decides how to go on. So far: {sofar}",
  "notice.delegation.limit.returnedTime":
    "{who} ran out of time on “{task}”. {caller} has its report and decides how to go on. So far: {sofar}",
  "notice.delegation.limit.open": "Open session",
  "notice.delegation.limit.loading": "Checking session…",
  "notice.delegation.limit.working": "Still working",
  "notice.delegation.limit.queued": "Queued",
  "notice.delegation.limit.waiting": "Waiting for your answer",
  "notice.delegation.limit.completed": "Finished",
  "notice.delegation.limit.continue": "Continue",
  "notice.delegation.limit.continuing": "Continuing…",
  "notice.delegation.limit.offline": "Offline: current session status unavailable",
  "notice.delegation.limit.unavailable": "Could not check session status",
  "notice.delegation.limit.continuePrompt":
    "Continue the remaining work in this session from the last progress report. Keep the existing scope and permissions; report the result to the original caller.",
  "notice.delegation.limit.stop": "Stop it",
  "notice.delegation.limit.stopped": "Stopped",
  "notice.delegation.limit.ended": "It had already ended",
  "notice.delegation.continued": "APX continued this session after a limit stopped it.",
  "notice.run.interrupted": "Interrupted by a restart of APX.",
  "notice.run.resumed": "Interrupted by a restart of APX; picking it back up.",
  "notice.run.canceled": "Canceled.",
  "notice.run.failed": "Could not finish.",
  "notice.run.empty": "Finished without a message.",
  "notice.harness.fallback": "The chosen engine was not available; answered with the built-in model.",
  "notice.info": "Note",
  "notice.warn": "Warning",
  "notice.engine.fallback": "{model} did not answer ({why}); went on with {to}.",
  "notice.engine.fallback.title": "Switched model",
  "notice.thread.compacted":
    "Earlier turns were summarized to keep this chat's context small. Nothing new was started.",
  "notice.pairing.request": "Someone new wants to talk on a channel: approve them in Settings → Channels.",
};

export type NoticeKey = keyof typeof noticeEn;

export const noticeEs: Record<NoticeKey, string> = {
  "notice.run.stepLimit":
    "Se quedó sin pasos en este turno: es un informe de lo hecho y lo que falta, no una respuesta final.",
  "notice.run.noModel": "Sin modelo disponible: ninguno de los modelos pudo responder (sin cupo, sin sesión o caído).",
  "notice.run.noModel.limit": "Frenado por el límite de uso del proveedor de modelos, que se libera a las {until}.",
  "notice.run.noModel.limitUnknown":
    "Frenado por el límite de uso del proveedor de modelos (no dijo cuándo se libera).",
  "notice.routine.shell": "Corrió el comando.",
  "notice.routine.watch.quiet": "Nada nuevo que vigilar: no se llamó al modelo.",
  "notice.routine.relay.quiet": "No hay novedades del equipo: no se llamó al modelo.",
  "notice.routine.pre.ok": "Comando previo: ok",
  "notice.routine.pre.failed": "Comando previo: falló (código {exit})",
  "notice.routine.pre.timeout": "Comando previo: se cortó por tiempo",
  "notice.routine.post.ok": "Comando posterior: ok",
  "notice.routine.post.failed": "Comando posterior: falló (código {exit})",
  "notice.routine.post.timeout": "Comando posterior: se cortó por tiempo",
  "notice.routine.skipped": "No se llamó al modelo; el resultado del comando previo no lo pedía.",
  "notice.breaker.paused.runs":
    "En pausa: los agentes hicieron {spent} turnos solos desde tu último mensaje acá. {who} terminó; escribí para seguir.",
  "notice.breaker.paused.tokens":
    "En pausa: los agentes gastaron {spent} tokens solos desde tu último mensaje acá. {who} terminó; escribí para seguir.",
  "notice.breaker.paused.link": "Cambiar el límite",
  "notice.breaker.held.runs":
    "En pausa: los agentes hicieron {spent} turnos solos desde tu último mensaje acá. {who} empieza «{task}» cuando los dejes seguir.",
  "notice.breaker.held.tokens":
    "En pausa: los agentes gastaron {spent} tokens solos desde tu último mensaje acá. {who} empieza «{task}» cuando los dejes seguir.",
  "notice.breaker.held.agentRuns":
    "En pausa para {who}: {who} hizo {spent} turnos solo desde tu último mensaje acá, su propio límite. Empieza «{task}» cuando los dejes seguir.",
  "notice.breaker.held.agentTokens":
    "En pausa para {who}: {who} gastó {spent} tokens solo desde tu último mensaje acá, su propio límite. Empieza «{task}» cuando los dejes seguir.",
  "notice.breaker.held.link": "Cambiar el límite",
  "notice.breaker.reset": "Reiniciar presupuesto",
  "notice.breaker.release": "Liberar en esta ronda",
  "notice.breaker.wentOn": "Los agentes siguieron",
  "notice.delegation.limit.continuedSteps":
    "{who} se quedó sin pasos con «{task}»; APX lo hizo seguir una vez en la sesión {session}. Hasta ahora: {sofar}",
  "notice.delegation.limit.continuedTime":
    "{who} se quedó sin tiempo con «{task}»; APX lo hizo seguir una vez en la sesión {session}. Hasta ahora: {sofar}",
  "notice.delegation.limit.returnedSteps":
    "{who} se quedó sin pasos con «{task}». {caller} tiene su informe y decide cómo seguir. Hasta ahora: {sofar}",
  "notice.delegation.limit.returnedTime":
    "{who} se quedó sin tiempo con «{task}». {caller} tiene su informe y decide cómo seguir. Hasta ahora: {sofar}",
  "notice.delegation.limit.open": "Abrir sesión",
  "notice.delegation.limit.loading": "Consultando sesión…",
  "notice.delegation.limit.working": "Sigue trabajando",
  "notice.delegation.limit.queued": "En cola",
  "notice.delegation.limit.waiting": "Esperando tu respuesta",
  "notice.delegation.limit.completed": "Terminó",
  "notice.delegation.limit.continue": "Continuar",
  "notice.delegation.limit.continuing": "Continuando…",
  "notice.delegation.limit.offline": "Sin conexión: estado actual no disponible",
  "notice.delegation.limit.unavailable": "No pude consultar estado de sesión",
  "notice.delegation.limit.continuePrompt":
    "Continuá el trabajo pendiente en esta sesión desde el último informe. Conservá el alcance y los permisos existentes; informá el resultado a quien te delegó.",
  "notice.delegation.limit.stop": "Detenerla",
  "notice.delegation.limit.stopped": "Detenida",
  "notice.delegation.limit.ended": "Ya había terminado",
  "notice.delegation.continued": "APX siguió esta sesión después de que un límite la detuviera.",
  "notice.run.interrupted": "Se interrumpió por un reinicio de APX.",
  "notice.run.resumed": "Se interrumpió por un reinicio de APX; lo retomo.",
  "notice.run.canceled": "Cancelado.",
  "notice.run.failed": "No pude terminar.",
  "notice.run.empty": "Terminó sin mensaje.",
  "notice.harness.fallback": "El motor elegido no estaba disponible; respondió el modelo propio.",
  "notice.info": "Nota",
  "notice.warn": "Aviso",
  "notice.engine.fallback": "{model} no respondió ({why}); siguió con {to}.",
  "notice.engine.fallback.title": "Cambió de modelo",
  "notice.thread.compacted":
    "Se resumieron los turnos anteriores para que el contexto de este chat sea más chico. No se empezó nada nuevo.",
  "notice.pairing.request": "Alguien nuevo quiere hablar por un canal: aprobalo en Configuración › Canales.",
};

export const noticeZh: Record<NoticeKey, string> = {
  "notice.run.stepLimit": "本轮已用完步骤：这是已完成和待办事项的报告，并非最终答复。",
  "notice.run.noModel": "没有可用模型：所有模型都无法回答（额度用尽、未登录或服务中断）。",
  "notice.run.noModel.limit": "已因模型提供商的使用限额停止，该限额将在 {until} 恢复。",
  "notice.run.noModel.limitUnknown": "已因模型提供商的使用限额停止（未提供恢复时间）。",
  "notice.routine.shell": "命令已运行。",
  "notice.routine.watch.quiet": "没有新的监看内容：未调用模型。",
  "notice.routine.relay.quiet": "没有可转告的团队动态：未调用模型。",
  "notice.routine.pre.ok": "前置命令：成功",
  "notice.routine.pre.failed": "前置命令：失败（退出码 {exit}）",
  "notice.routine.pre.timeout": "前置命令：超时",
  "notice.routine.post.ok": "后置命令：成功",
  "notice.routine.post.failed": "后置命令：失败（退出码 {exit}）",
  "notice.routine.post.timeout": "后置命令：超时",
  "notice.routine.skipped": "未调用模型；前置命令的结果没有要求调用。",
  "notice.breaker.paused.runs":
    "已暂停：自你上次在此发言后，智能体已自主启动 {spent} 轮对话。{who} 已完成；发送消息即可继续。",
  "notice.breaker.paused.tokens":
    "已暂停：自你上次在此发言后，智能体已自主使用 {spent} 个 token。{who} 已完成；发送消息即可继续。",
  "notice.breaker.paused.link": "更改限额",
  "notice.breaker.held.runs":
    "已暂停：自你上次在此发言后，智能体已自主启动 {spent} 轮对话。允许继续后，{who} 将开始“{task}”。",
  "notice.breaker.held.tokens":
    "已暂停：自你上次在此发言后，智能体已自主使用 {spent} 个 token。允许继续后，{who} 将开始“{task}”。",
  "notice.breaker.held.agentRuns":
    "已为 {who} 暂停：自你上次在此发言后，{who} 已自主启动 {spent} 轮对话，达到其自身限额。允许继续后，它将开始“{task}”。",
  "notice.breaker.held.agentTokens":
    "已为 {who} 暂停：自你上次在此发言后，{who} 已自主使用 {spent} 个 token，达到其自身限额。允许继续后，它将开始“{task}”。",
  "notice.breaker.held.link": "更改限额",
  "notice.breaker.reset": "重置额度",
  "notice.breaker.release": "允许完成本轮",
  "notice.breaker.wentOn": "智能体已继续",
  "notice.delegation.limit.continuedSteps":
    "{who} 在“{task}”中用完了步骤；APX 已让它在对话 {session} 中继续一次。目前进展：{sofar}",
  "notice.delegation.limit.continuedTime":
    "{who} 在“{task}”中用完了时间；APX 已让它在对话 {session} 中继续一次。目前进展：{sofar}",
  "notice.delegation.limit.returnedSteps":
    "{who} 在“{task}”中用完了步骤。{caller} 已收到其报告，并将决定如何继续。目前进展：{sofar}",
  "notice.delegation.limit.returnedTime":
    "{who} 在“{task}”中用完了时间。{caller} 已收到其报告，并将决定如何继续。目前进展：{sofar}",
  "notice.delegation.limit.open": "打开对话",
  "notice.delegation.limit.loading": "正在检查对话…",
  "notice.delegation.limit.working": "仍在处理",
  "notice.delegation.limit.queued": "已排队",
  "notice.delegation.limit.waiting": "正在等待你的回复",
  "notice.delegation.limit.completed": "已完成",
  "notice.delegation.limit.continue": "继续",
  "notice.delegation.limit.continuing": "正在继续…",
  "notice.delegation.limit.offline": "离线：无法获取当前对话状态",
  "notice.delegation.limit.unavailable": "无法检查对话状态",
  "notice.delegation.limit.continuePrompt":
    "从上次进度报告继续完成此对话中的剩余工作。保持现有范围和权限，并将结果报告给原调用方。",
  "notice.delegation.limit.stop": "停止",
  "notice.delegation.limit.stopped": "已停止",
  "notice.delegation.limit.ended": "已结束",
  "notice.delegation.continued": "APX 已在达到限额后继续此对话。",
  "notice.run.interrupted": "因 APX 重启而中断。",
  "notice.run.resumed": "因 APX 重启而中断；正在恢复。",
  "notice.run.canceled": "已取消。",
  "notice.run.failed": "未能完成。",
  "notice.run.empty": "已完成，但没有消息。",
  "notice.harness.fallback": "所选引擎不可用；已由内置模型回答。",
  "notice.info": "提示",
  "notice.warn": "警告",
  "notice.engine.fallback": "{model} 未回答（{why}）；已改用 {to}。",
  "notice.engine.fallback.title": "已切换模型",
  "notice.thread.compacted": "已总结较早轮次以缩短此对话的上下文，没有开始新的工作。",
  "notice.pairing.request": "有新联系人想通过渠道对话：请前往“设置 → 渠道”批准。",
};

const NOTICES = { en: noticeEn, es: noticeEs, zh: noticeZh } as const;

const fill = (text: string, vars: Record<string, string | number> = {}) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** The key a notice reads from: its code, and the wording its `variant` picks (`notice.<code>.<variant>`). */
export const noticeKey = (part: { code: string; vars?: Record<string, string | number> | undefined }) =>
  `notice.${part.code}${part.vars?.variant ? `.${part.vars.variant}` : ""}`;

/**
 * A notice in `lang`: the translation when there is one and the notice is the plain case (it has vars, or its English
 * carries no details after a colon), else the core's own text.
 */
export function noticeText(
  part: { code: string; text: string; vars?: Record<string, string | number> | undefined },
  lang: keyof typeof NOTICES,
): string {
  const key = noticeKey(part);
  if (!Object.hasOwn(noticeEn, key) || (!part.vars && part.text.includes(":"))) return part.text;
  return fill(NOTICES[lang][key as NoticeKey], part.vars);
}
