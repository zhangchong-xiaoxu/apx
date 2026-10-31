import type { enThreadDialogs } from "./thread-dialogs-en.ts";

export const zhThreadDialogs: Record<keyof typeof enThreadDialogs, string> = {
  "inbox.markAllRead.body": "将 {n} 个对话标记为已读？它们的未读标记将被清除。",
  "thread.rename.title": "重命名对话",
  "thread.rename.label": "名称",
  "thread.rename.hint": "留空则恢复为自动生成的标题。",
  "thread.delete.title": "删除对话",
  "thread.delete.body": "此操作无法撤销。",
  "thread.delete.what": "“{title}”及其所有消息将被删除。",
  "thread.delete.confirm": "删除",
};
