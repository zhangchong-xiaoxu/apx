import type { MessageKey } from "./en.ts";

// Shared setup labels used outside the setup screens.
export const zhSetup: Partial<Record<MessageKey, string>> = {
  "setup.beta": "测试版",
  "setup.engines.model": "模型",
  "setup.channels.soon": "即将推出",
  "setup.project.pick": "选择文件夹",
  "setup.project.pathPlaceholder": "/path/to/your/project",
  "setup.project.added": "已添加：{name}",
  "setup.menu": "首次运行设置",
  "connect.title": "你的 APX",
};
