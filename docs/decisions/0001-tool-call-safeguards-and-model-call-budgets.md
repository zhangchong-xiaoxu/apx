---
type: decision
id: 0001
status: active
updated: 2026-11-05
supersedes:
superseded_by:
---

# 0001 · 防止无效工具调用并限制长运行模型成本

## 摘要

修复 APX 原生 agent loop 中不完整、格式错误或重复的工具调用可能造成的重试、provider 转换失败和副作用风险；为单个 agent 增加每次 run 的模型调用上限。以 provider 请求历史投影处理兼容性，不篡改已保存的对话。已随 `v2.12.7`（`05a4eb5b1ec0`）发布，本机桌面版已更新；research agent 的 `steps=25` 与真实 LiteLLM 验证仍未完成。

## 背景与问题

- 排查时见到无效工具参数会再次进入工具循环；本地一次 research run 记录了约 85 次工具调用和约 8.9M 累计输入 tokens。这是多次模型请求的累计值，不是一次上下文大小，也不能直接推出费用。
- 日志未保留足以确认 LiteLLM 每次失败根因的请求、响应与 finish reason；因此不能断言所有重复失败均由同一种工具参数问题导致。
- 原生 harness 的 run 步数默认值为 150。以前的历史投影不能限制同一 run 中不断增长的上下文或累计请求数。
- LiteLLM 的 provider 转换会重解析工具历史；仅将坏 JSON 原样保留或静默替换成 `{}` 都不能可靠地跨 provider 重放。
- 代码入口：[native.ts](../../apps/core/src/harness/native.ts)、[llm.ts](../../apps/core/src/providers/llm.ts)、[pipeline.ts](../../apps/core/src/engine/pipeline.ts)。

## 目标 / 非目标

- 目标：不执行不完整、参数无效或含重复调用 ID 的工具批次；给模型可修正的错误反馈；让发往 provider 的历史投影有效且不改变原始 transcript。
- 目标：可配置单 agent 每次 native run 的模型调用上限，覆盖重试、fallback 和最终报告；旧客户端不得静默清除该上限。
- 目标：保留默认行为和 routine 更严格的步数限制，并提供 UI、CLI、协议、RPC、回归测试及英文/西班牙文文档。
- 非目标：不保证所有 LiteLLM 错误都由本次修复；不限制单次请求 tokens、不控制外部 SDK harness、不改用户网关配置或引入新依赖。
- 非目标：本次不修复 DeepSeek 思考模式跨 provider fallback 缺少 `reasoning_content` 的独立问题，也不声称完成真实 LiteLLM 端到端验证。

## 方案与取舍

### 选项 A：只调高输出上限或重试次数

- 好：实现少，可处理部分截断。
- 坏：不能保护工具副作用、坏历史重放和长 run 累计成本；不能证明 LiteLLM 错误都与输出上限有关。

### 选项 B：在 APX 边界校验工具调用，并增加 per-agent 调用预算（选定）

- 好：在执行副作用前拒绝坏批次； provider 只收到经过投影的历史；预算覆盖 retries、fallback 与 final report；复用现有 protocol、UI、CLI 和 test harness。
- 坏：调用数上限不是 token 或费用上限；provider 特有的历史语义仍需逐个验证；真实 gateway 行为须另行验证。

### 选项 C：引入其他 agent SDK、统一 token 预算或修改网关缓存配置

- 好：可使用额外 runtime 或 provider 能力。
- 坏：扩大架构和配置影响；token、缓存和账单语义依赖 provider，不能由已有日志可靠推断；本问题可用现有实现解决，暂不增加依赖。

### 参考资料

于 2026-11-05 查阅官方文档与固定版本源码；SDK 的默认步数仅作比较，不直接照搬：

- [Vercel AI SDK：tool-call parsing](https://github.com/vercel/ai/blob/3fab50aa9b72d2828881cb25d13a41eddf78211c/packages/ai/src/generate-text/parse-tool-call.ts#L24) 与 [loop control](https://ai-sdk.dev/docs/agents/loop-control)。
- [OpenAI Agents JS：tool execution](https://github.com/openai/openai-agents-js/blob/a52bc6fab24a0b967befa5220c3430b4edbedb52/packages/agents-core/src/runner/toolExecution.ts#L679) 与 [running agents](https://openai.github.io/openai-agents-js/guides/running-agents/)。
- [Anthropic tool runner](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-runner) 与 [handling `max_tokens`](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons#max-tokens)。
- [LiteLLM Anthropic provider](https://docs.litellm.ai/docs/providers/anthropic)；[固定上游转换实现](https://github.com/BerriAI/litellm/blob/f5e740e69ab20b010f6477f2837684aaf3b06539/litellm/litellm_core_utils/prompt_templates/factory.py#L2181)。
- [DeepSeek thinking mode](https://api-docs.deepseek.com/guides/thinking_mode)。

## 决定

采用选项 B。校验工具批次及参数后才执行；不完整响应和重复 ID 整批拒绝。保留规范 transcript，按 provider 请求需要投影有效的工具参数历史。无效调用不宣称成功，工具关闭时不接受模型返回的工具调用。

新增 `AgentBudget.steps`（1–150）作为 native loop 的每次 run 模型调用总上限，计入 provider 重试、模型 fallback 与最终总结；routine 自身更小的上限仍优先。默认值保持 150。预算耗尽时保留最终报告机会，并优先使用上一轮成功且可用的模型。旧客户端修改预算时必须显式提供 `merge`。

- 代价：不封顶一次请求的 tokens，不保证不同模型间历史协议完全相同。
- 复查触发：观察到预算内单次请求仍造成不可接受的上下文或费用时，基于 provider 实际 usage 评估 token/费用预算；如再次发现 LiteLLM 特定失败，先保存脱敏请求/响应元数据并按 gateway 版本复现。

## 验收

- 对不完整/非法 JSON、重复工具调用 ID 和关闭工具后的响应：没有相关副作用；模型收到可行动错误或诚实的无工具总结。
- provider 重试、fallback、正常完成和最后一次总结都计入 per-agent 上限；预算耗尽不会谎报操作成功。
- Team UI、CLI、协议与 RPC 可设置、展示、恢复和清除预算；旧客户端不能静默清除 `steps`。
- 完成针对改动的测试、`pnpm preflight` 和候选提交的 GitHub `verify`；仅在精确 `master` 提交验证通过后发布。
- 部署后检查现有 Desktop/core 身份与 home、browser 和数据完整性；经用户同意后设置 research agent 的 `steps=25` 并读回。升级自动公告已获用户允许，但真实模型调用仍不是本次 LiteLLM 验证。

## 实施计划

- [x] 工具批次校验、provider 历史投影、重试/fallback/总结预算边界及回归测试。
- [x] 将预算接通协议、RPC、CLI、Team UI、确认卡、release news 及英文/西班牙文用户文档。
- [x] 将候选 `1965388cbf409aa5ef1d7bf09acee850c4162e56` 快进并推送到 `master`；精确提交的远端验证未通过。
- [x] 修复两个被 CI 暴露的浏览器测试隔离问题；定向组合测试 27/27 通过。
- [x] Windows `fetch` 禁用端口查明为本机 TCP 动态端口范围从 1024 起，已改回 49152 起（机器侧，不改产品）；见 [FAILURE_LEDGER](../../rules/FAILURE_LEDGER.md)。
- [x] `05a4eb5` 的 GitHub verify 全绿后由 `release:check` 打 `v2.12.7` tag，发布成功。
- [x] 桌面版由用户在“设置 > 关于”更新；`/health` 显示 `2.12.7 / 05a4eb5b1e`。agent 未执行备份步骤。
- [ ] 设置并读回 Topic researcher（`91904e24b12e-topic-researcher`）的 `steps=25`。

## 进度

- [x] (2026-11-05) 选定 Topic researcher 每次 run 最多 25 次模型调用；当前安装仍为 2.12.6，生产设置尚未修改。
- [x] (2026-11-05) 基线提交 `1965388c` 的 GitHub verify 失败：panel coverage 2/3、3/3 失败；macOS 2/2 初次运行取消。单独重跑 macOS 2/2 通过。
- [x] (2026-11-05) 本地聚焦 E2E 组合测试 27/27 通过，两个失败已定位为共享预算污染与 Northwind 项目名前缀歧义。
- [x] (2026-11-05) 两个 E2E 隔离修复已提交并推送为 [`05a4eb5`](https://github.com/zhangchong-xiaoxu/apx/commit/05a4eb5b1ec0b98b4d3aefe18566402c81cc3563)，新候选 [GitHub verify 42013816772](https://github.com/zhangchong-xiaoxu/apx/actions/runs/42013816772) 开始运行。
- [x] (2026-11-05) 对包含 E2E 修复的代码运行 `pnpm preflight`，在 unit tests 失败：`apps/core/src/rpc/subtask-ownership.test.ts` 的 `fetch` 收到 `bad port`（动态分配到禁用端口 6566）；该测试单独重跑 1/1 通过。完整预检仍未通过。
- [x] (2026-11-05) `v2.12.7` 已发布，本机更新到 2.12.7；以下为暂停时的旧状态：`fix/cli-budget-help` worktree 干净并位于候选 `05a4eb5`；须确认其 CI 结果，再修复禁用端口问题并重跑完整预检。用户选择暂停，不得自行继续验证、推送、发布或部署。主 checkout 仍落后 `origin/master` 一提交且有既有未提交修改；另一 `docs/local-verification-loop` worktree 也须保留。

## 发现

- Node fetch 的禁用端口范围与系统随机动态端口范围有交集；随机 `listen(0)` 可能返回 `6566`，导致 fetch 在连到本地服务前报 `bad port`。本地单测曾因此未能清理 server 子进程；单独重跑避开该端口后通过。
- 旧候选 verify 失败记录：[GitHub Actions run 42006240746](https://github.com/zhangchong-xiaoxu/apx/actions/runs/42006240746)。其 macOS 2/2 作业曾取消，重跑 job 最终成功；两个 panel coverage 失败仍使该候选的 verify 为失败。
- 当前全量预检未通过，不能以之前候选树的 `pnpm preflight` 结果替代当前树验证。
- 生产 APX 在暂停时为 2.12.6 / `1febcd69246c`；`v2.12.7` 尚未发布。生产没有设置 `steps=25`，没有真实 LiteLLM 请求。
- 复核交接状态时，`origin/master` 已前进到 `05a4eb5`，其 GitHub verify 尚在运行；本地主 checkout 仍停在 `1965388c`。不得因本地分支落后而覆盖其中既有修改。
- 另一个 APX worktree `docs/local-verification-loop` 的提交 `324efab04` 尚未推送，基准及其配套规则决策仍待处理；独立基础设施账本保留了本次桌面更新计划，SHA 需在部署前刷新。
- [CONTEXT_COMPACTION.md](../../rules/CONTEXT_COMPACTION.md) 的提案提交 `0ea8af634` 仅在 `fix/tool-finalization` 历史中，不是当前 `master` 的内容；其多模型窗口选择等问题仍待决定。

## 决策日志

- 2026-11-05：用户选择每个 research run 最多 25 次模型调用。
- 2026-11-05：用户同意完成发布与部署时允许 APX 正常执行其既有自动更新公告；此授权不代表真实模型请求已验证。
- 2026-11-05：用户选择暂停，不继续本地全量重跑、推送、发布或部署；下次继续前须先确认恢复任务。
- 2026-11-05：用户在新会话恢复并授权完成发布；E2E 修复提交、`v2.12.7` 发布，桌面版由用户自行更新。

## 结果与回顾

工具调用防护和模型调用预算随 `v2.12.7` 发布，本机已运行该版本。未完成：Topic researcher 的 `steps=25` 尚未设置；LiteLLM 真实 gateway、provider 缓存和实际账单均未端到端验证，不能将累计 tokens 解读为实际费用。过程复盘：一个会话叠加了诊断、修复、SDK 对照、新功能、落后 373 个提交的合并与发版，加上 Windows 环境问题，导致耗时过长；改进见 D-186 与 [FAILURE_LEDGER](../../rules/FAILURE_LEDGER.md)。
