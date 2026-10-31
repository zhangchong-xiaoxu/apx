import type { enEmailSignatures } from "./en-email-signatures.ts";

export const zhEmailSignatures: Record<keyof typeof enEmailSignatures, string> = {
  "signature.title": "邮件签名",
  "signature.lead": "每个 Gmail 或 SMTP 账户使用一个签名，适用于新邮件和回复。你也可以要求不添加。",
  "signature.account": "邮箱账户",
  "signature.choose": "选择账户",
  "signature.enabled": "自动添加签名",
  "signature.text": "纯文本签名",
  "signature.html": "HTML 签名（可选）",
  "signature.htmlHint":
    "支持基础格式（p、div、span、b、strong、em、i、u、br）、链接（a）和 HTTPS 图片（img）。属性值必须使用双引号。不支持脚本、样式或嵌入图片。必须填写纯文本版本。",
  "signature.importHint": "没有导入 Gmail 签名的权限，请在此复制签名。不会更改 Gmail 设置或已有草稿。",
  "signature.noAccounts": "请在资源中连接 Gmail，或在设置中添加 Email 渠道，然后配置签名。",
  "signature.loading": "正在加载签名…",
  "signature.saved": "签名设置已保存",
  "signature.error": "无法保存签名。请检查必填文本和支持的 HTML，然后重试。",
  "signature.remove": "移除签名",
};
