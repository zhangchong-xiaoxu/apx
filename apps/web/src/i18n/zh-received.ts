import type { ReceivedKey } from "./received-en.ts";

export const zhReceived: Record<ReceivedKey, string> = {
  "received.title": "收到的内容",
  "received.description": "此轮首次调用时发送给模型的内容，按原样展示。",
  "received.system": "系统提示",
  "received.input": "本轮输入",
  "received.tools": "工具（{n}）",
  "received.history": "此前的对话（{n} 项）",
  "received.size": "{chars} 个字符 · 约 {tokens} 个词元",
  "received.part.base": "APX 自身的文本",
  "received.part.profile": "档案",
  "received.part.personality": "个性",
  "received.part.instructions": "指令",
  "received.part.owner": "关于你",
  "received.part.agentsMd": "项目 AGENTS.md",
  "received.part.org": "领域与角色",
  "received.part.projectMemory": "项目笔记",
  "received.part.skills": "技能",
  "received.part.message": "消息",
};
