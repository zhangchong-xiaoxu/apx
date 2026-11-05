# Progress

更新日期：2026-11-05

<!-- 模板：obsidian_data/templates/repo/progress.md。本页是跨会话入口与摘要，细节写在 decision 文档；handover 改前五节并在交接日志顶部加一条。 -->

## 当前状态

工具调用防护和 per-agent 模型调用预算已随 `v2.12.7`（`05a4eb5`）发布，本机桌面版运行 2.12.7，详见 [0001](decisions/0001-tool-call-safeguards-and-model-call-budgets.md)。本地验证阶梯、分支 CI 与发版步骤见 [rules/LOCAL_VERIFICATION.md](../rules/LOCAL_VERIFICATION.md)，与改动无关的失败记在 [rules/FAILURE_LEDGER.md](../rules/FAILURE_LEDGER.md)（D-186）。

## 下一步

1. 给 Topic researcher 设置模型调用上限并读回：`apx agents limits 91904e24b12e-topic-researcher steps=25`，或在 Team 里右键该 agent 编辑。
2. 已推送的 `05a4eb5b1`（`v2.12.7`）与 `e4b794181` 含个人邮箱和 AI trailer（规则 17）；是否改写 `master` 历史待用户决定。
3. 按需观察 FAILURE_LEDGER 中 macOS `browser-consent-vm` 与 perf `turn_p95_ms`，达到阈值即修。

## 进行中 / 卡住

- 真实 LiteLLM gateway、provider 缓存与实际账单未端到端验证。
- 上下文压缩提案提交 `0ea8af634` 仅在本地分支 `fix/tool-finalization` 历史中，取舍待决定；保留该分支，勿删。
- “受影响测试”自动映射脚本未做（dev-brain 决策中的后续项）；目前按 LOCAL_VERIFICATION 手选聚焦测试。
- 主 checkout 另有其他会话的未提交改动（artifacts 相关），不属于本页任务。

## 怎么验证还能用

以下快速检查不调用 LLM：

```text
apx status                                  # 预期：Core 2.12.7 · 05a4eb5b1e…
apx agents limits                           # 预期：列出默认与各 agent 限额
node scripts/verify.ts preflight            # Node < 24.11 时预期立即报错退出
```

注意：`check:private` 在 Windows 上空跑的问题已修复；修复前在 Windows 上的扫描结果都不可信。

## 资料入口

- [文档地图与决策索引](README.md)
- [工具调用防护与模型调用预算](decisions/0001-tool-call-safeguards-and-model-call-budgets.md)
- 验证与失败台账：[rules/LOCAL_VERIFICATION.md](../rules/LOCAL_VERIFICATION.md)、[rules/FAILURE_LEDGER.md](../rules/FAILURE_LEDGER.md)
- 上游同步规则：[rules/FORK_SYNC.md](../rules/FORK_SYNC.md)；发布规则：[rules/RELEASE.md](../rules/RELEASE.md)

## 交接日志

<!-- 新条目加在最上面，最多 10 条，超出删最旧的；只写摘要，细节在 decision 的进度与决策日志。 -->

- 2026-11-05：`v2.12.7`（`05a4eb5`）发布，本机已更新；验证阶梯合入 `e4b7941`（`verify.ts` 拒绝旧 Node、分支 CI、发版步骤）；新增 D-186 与 `rules/FAILURE_LEDGER.md` 记录非本次改动导致的失败；本机 TCP 动态端口范围改回 49152 起（home-lab-ops `85b9a1f`）；个人 harness 增加“一会话一交付”。
- 2026-11-05：工具调用防护与 per-agent 模型调用预算已接入；聚焦 E2E 27/27、`pnpm check:schema` 和新增文档链接/空白检查通过；完整 `pnpm preflight` 遇到禁用端口失败。实际 Windows 公开形状扫描输出 `no private list + 2 shapes`。测试临时目录确认无外部进程后已清理。旧候选 `1965388c` verify 失败；E2E 修复已在 `05a4eb5` 推送，新 verify `42013816772` 当时仍在运行；未发布。细节见 decision 0001。
- 2026-11-05：本地验证流程改进提交 `324efab04` 留在 `docs/local-verification-loop` worktree/分支，未推送；基准与配套规则决策仍待处理。
- 2026-11-05：上下文压缩提案提交 `0ea8af634` 仅在 `fix/tool-finalization` 历史中，不在当前 `master`；取舍待决定。
- 2026-11-04：上游同步发布 `v2.12.6` 成功，commit `1febcd69246c`；性能预算例外未修改。
