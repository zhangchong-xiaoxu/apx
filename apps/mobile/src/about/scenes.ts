import type { Lang } from "../i18n/index.ts";

/** One portrait: the blob it draws, the file it is drawn with, and that file's text. */
export type Scene = { key: string; file: string; text: string };

const agentFile = (fm: Array<[string, string]>, body: string) =>
  `---\n${fm.map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n${body}`;

// The landing's crew: an agent is a markdown file, and it remembers in another one.
const SCENES: Record<Lang, Scene[]> = {
  en: [
    {
      key: "perla",
      file: "tomas.md",
      text: agentFile(
        [
          ["name", "Tomás"],
          ["role", "Developer"],
          ["description", "Keeps the online store running: checkout, catalog and payments."],
          ["runtime", "claude-code"],
          ["icon", "perla"],
        ],
        "You are Tomás, the developer. Reproduce first, fix second, and always say which test proves it.",
      ),
    },
    {
      key: "papa",
      file: "night/memory.md",
      text: "# memory · night shift\n- Backups at 3:00, report at 9:00.\n- If a routine fails twice, tell Nova, not the owner.\n- Keep the log short: what ran, what broke, what is next.",
    },
    {
      key: "orbita",
      file: "lucia.md",
      text: agentFile(
        [
          ["name", "Lucía"],
          ["role", "Product manager"],
          ["description", "Owns the Acme Store roadmap and hands out the work."],
          ["autonomy", "total"],
          ["icon", "orbita"],
        ],
        "You are Lucía, product manager at Acme Store. Split big asks into tasks, assign them, and follow up until they close.",
      ),
    },
    {
      key: "menta",
      file: "nova/memory.md",
      text: "# memory · nova\n- The owner reads Telegram first thing, WhatsApp after lunch.\n- Never wake them for less than a blocker.\n- Weekly report goes out Mondays at 9:00.",
    },
    {
      key: "caracol",
      file: "vera.md",
      text: agentFile(
        [
          ["name", "Vera"],
          ["role", "Marketing"],
          ["description", "Writes campaigns, newsletters and social posts."],
          ["skills", "[newsletter, social-posts]"],
          ["icon", "caracol"],
        ],
        "You are Vera. Short copy, one idea per post, and nothing goes out without a date.",
      ),
    },
    {
      key: "parche",
      file: "desk/memory.md",
      text: "# memory · whatsapp desk\n- Answer saved contacts only.\n- Orders: say it ships, never promise a date.\n- Anything about money goes to the owner on Telegram.",
    },
  ],
  es: [
    {
      key: "perla",
      file: "tomas.md",
      text: agentFile(
        [
          ["name", "Tomás"],
          ["role", "Desarrollador"],
          ["description", "Mantiene la tienda online andando: checkout, catálogo y pagos."],
          ["runtime", "claude-code"],
          ["icon", "perla"],
        ],
        "Sos Tomás, el desarrollador. Primero reproducí, después arreglá, y siempre decí qué test lo prueba.",
      ),
    },
    {
      key: "papa",
      file: "night/memory.md",
      text: "# memoria · turno noche\n- Backups a las 3:00, reporte a las 9:00.\n- Si una rutina falla dos veces, avisale a Nova, no al dueño.\n- Log corto: qué corrió, qué se rompió, qué sigue.",
    },
    {
      key: "orbita",
      file: "lucia.md",
      text: agentFile(
        [
          ["name", "Lucía"],
          ["role", "Product manager"],
          ["description", "Es dueña del roadmap de Acme Store y reparte el trabajo."],
          ["autonomy", "total"],
          ["icon", "orbita"],
        ],
        "Sos Lucía, product manager de Acme Store. Dividí los pedidos grandes en tareas, asignalas y seguilas hasta que se cierren.",
      ),
    },
    {
      key: "menta",
      file: "nova/memory.md",
      text: "# memoria · nova\n- El dueño lee Telegram a primera hora y WhatsApp después de almorzar.\n- Nunca lo despiertes por menos que un bloqueo.\n- El reporte semanal sale los lunes a las 9:00.",
    },
    {
      key: "caracol",
      file: "vera.md",
      text: agentFile(
        [
          ["name", "Vera"],
          ["role", "Marketing"],
          ["description", "Escribe campañas, newsletters y posteos para redes."],
          ["skills", "[newsletter, social-posts]"],
          ["icon", "caracol"],
        ],
        "Sos Vera. Textos cortos, una idea por posteo, y nada sale sin fecha.",
      ),
    },
    {
      key: "parche",
      file: "desk/memory.md",
      text: "# memoria · mesa de whatsapp\n- Contestá sólo a contactos guardados.\n- Pedidos: decí que sale, nunca prometas una fecha.\n- Todo lo de plata va al dueño por Telegram.",
    },
  ],
  zh: [
    {
      key: "perla",
      file: "tomas.md",
      text: agentFile(
        [
          ["name", "Tomás"],
          ["role", "开发者"],
          ["description", "维护在线商店的结账、商品目录和支付功能。"],
          ["runtime", "claude-code"],
          ["icon", "perla"],
        ],
        "你是开发者 Tomás。先复现，再修复，并始终说明哪项测试可以证明结果。",
      ),
    },
    {
      key: "papa",
      file: "night/memory.md",
      text: "# 记忆 · 夜班\n- 3:00 备份，9:00 汇报。\n- 如果自动任务连续失败两次，通知 Nova。",
    },
    {
      key: "orbita",
      file: "lucia.md",
      text: agentFile(
        [
          ["name", "Lucía"],
          ["role", "产品经理"],
          ["description", "负责 Acme Store 的路线图并分配工作。"],
          ["autonomy", "total"],
          ["icon", "orbita"],
        ],
        "你是 Acme Store 的产品经理 Lucía。把大型需求拆成任务，分配任务并跟进进度。",
      ),
    },
    {
      key: "menta",
      file: "nova/memory.md",
      text: "# 记忆 · nova\n- 用户早上先看 Telegram，午饭后看 WhatsApp。\n- 除非遇到阻塞，否则不要打扰。",
    },
    {
      key: "caracol",
      file: "vera.md",
      text: agentFile(
        [
          ["name", "Vera"],
          ["role", "市场营销"],
          ["description", "撰写营销活动、邮件简报和社交媒体内容。"],
          ["skills", "[newsletter, social-posts]"],
          ["icon", "caracol"],
        ],
        "你是 Vera。文案要简短，每篇只表达一个观点，所有内容必须先确定发布日期。",
      ),
    },
    {
      key: "parche",
      file: "desk/memory.md",
      text: "# 记忆 · whatsapp 工作台\n- 只回复已保存的联系人。\n- 涉及资金的内容通过 Telegram 交给用户。",
    },
  ],
};

export const scenesFor = (language: Lang) => SCENES[language];
