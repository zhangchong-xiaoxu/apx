# Progress

更新日期：2026-11-05

<!-- 模板：obsidian_data/templates/repo/progress.md。本页是跨会话入口与摘要，细节写在 decision 文档；handover 改前五节并在交接日志顶部加一条。 -->

## 当前状态

工具调用防护和 per-agent 模型调用预算已随 `v2.12.7`（`05a4eb5`）发布，本机桌面版运行 2.12.7，Topic researcher 已设每次 run 最多 25 次模型调用，详见 [0001](decisions/0001-tool-call-safeguards-and-model-call-budgets.md)。本地验证阶梯、分支 CI 与发版步骤见 [rules/LOCAL_VERIFICATION.md](../rules/LOCAL_VERIFICATION.md)，与改动无关的失败记在 [rules/FAILURE_LEDGER.md](../rules/FAILURE_LEDGER.md)（D-186）。

## 下一步

1. 合并并发布“AI 驱动的浏览器标签页静音”（分支 `fix/agent-tab-mute`，worktree `.worktrees/agent-tab-mute`）：分支 CI [run 42029894492](https://github.com/zhangchong-xiaoxu/apx/actions/runs/42029894492) 唯一已知失败是 perf `turn_p95_ms`（157.3 ms，预算 60），在 FAILURE_LEDGER 记为第二次出现，按台账规则不能直接重跑放过。先用 `gh run view 42029894492 -R zhangchong-xiaoxu/apx --json jobs` 确认其余 job 全绿；再由用户决定：(a) 先在独立 `fix/` 分支查 perf turn p95 抖动，或 (b) 认定与本改动无关，重跑后合并。合并后 fast-forward `master`、`pnpm release:check origin/master --wait`、`pnpm release:check --tag v2.12.8 origin/master`。合并、打标签都需要用户批准（用户已说“先不合了”）。
2. 观察 Topic researcher 下几次 run 的 token 用量是否明显下降：`apx usage 7`（按模型看 turns 和 tokens）或 Team 里看该 agent 的 run 记录，对比此前每次 run 约 710K 累计输入；若因 25 次上限而频繁截断报告，再调 `apx agents limits 91904e24b12e-topic-researcher steps=N`。纯观察，不需要批准。
3. macOS `browser-consent-vm` 在 FAILURE_LEDGER 已疑似出现两次：下次 CI 再出现即在独立 `fix/` 分支按规则 26 修其等待逻辑（`apps/core/src/tools/browser-consent-vm.test.ts`）；完成条件是分支 CI 绿并在台账移到 Fixed。
4. 上下文压缩提案（本地分支 `fix/tool-finalization` 的 `0ea8af634`）是否采用，需要用户决定后另开会话。

## 进行中 / 卡住

- `fix/agent-tab-mute`（已推送，未合并）：嵌入式浏览器里由 agent 打开或接手的标签页用 `wc.setAudioMuted(true)` 静音，主人接管（Take control 或点击/键入页面）时取消静音，handoff 交回 agent 后重新静音（`apps/desktop/src/main/browser/host.ts`，测试在 `host.test.ts`，中英文 office/browser 文档已同步）。还没有手动静音按钮，主人开的空闲标签页不静音。没在真实桌面上验证（UNVERIFIED）。
- perf `turn_p95_ms` 在 Linux CI 上 30 天内第二次超预算（FAILURE_LEDGER），按规则要单独排查。
- 真实 LiteLLM gateway、provider 缓存与实际账单未端到端验证。
- 上下文压缩提案提交 `0ea8af634` 仅在本地分支 `fix/tool-finalization` 历史中，取舍待决定；保留该分支，勿删。
- “受影响测试”自动映射脚本未做（dev-brain 决策中的后续项）；目前按 LOCAL_VERIFICATION 手选聚焦测试。
- 已推送的 `05a4eb5b1`（`v2.12.7`）与 `e4b794181` 含个人邮箱和 AI trailer；用户决定不改写历史，已在 FAILURE_LEDGER 记录；本仓库本地 `user.email` 已改为 noreply，规则 17 禁止 AI trailer。
- APX 客户端的 harness 同步报 `MANAGED_MARKERS_INVALID`（个人 harness 仓库的问题，不在本仓库修）。
- 主 checkout 另有其他会话的未提交改动（artifacts 相关），不属于本页任务。

## 怎么验证还能用

以下快速检查不调用 LLM：

```text
apx status                                  # 预期：Core 2.12.7 · 05a4eb5b1ec0
apx agents limits                           # 预期：含 91904e24b12e-topic-researcher: 25 model calls/run
node scripts/verify.ts preflight            # Node < 24.11 时预期立即报错退出（Node 24 下会真正开始跑，较慢）
node --test scripts/check-private-terms.test.ts  # Node 24 下预期 5 pass
```

注意：`check:private` 在 Windows 上空跑的问题已修复；修复前在 Windows 上的扫描结果都不可信。

## 资料入口

- [文档地图与决策索引](README.md)
- [工具调用防护与模型调用预算](decisions/0001-tool-call-safeguards-and-model-call-budgets.md)
- 验证与失败台账：[rules/LOCAL_VERIFICATION.md](../rules/LOCAL_VERIFICATION.md)、[rules/FAILURE_LEDGER.md](../rules/FAILURE_LEDGER.md)
- 上游同步规则：[rules/FORK_SYNC.md](../rules/FORK_SYNC.md)；发布规则：[rules/RELEASE.md](../rules/RELEASE.md)

## 交接日志

<!-- 新条目加在最上面，最多 10 条，超出删最旧的；只写摘要，细节在 decision 的进度与决策日志。 -->

- 2026-11-05（handover）：agent 驱动的标签页静音提交在 `fix/agent-tab-mute`（`e3755e0a8`），`pnpm --filter @apx/desktop test` 131/131 通过、`pnpm preflight:static` 绿、`pnpm check:commits` ok；分支 CI 42029894492 的 perf `turn_p95_ms` 失败已记台账（第二次）；用户要重启，暂不合并。
- 2026-11-05（handover）：`check:private` 在 Windows 空跑的修复 `05d1a1284` 与失败台账合入 master，分支 CI 42023639391 绿；Topic researcher 已设 `steps=25` 并读回；基线 `apx status`（2.12.7 · 05a4eb5b1ec0）、`apx agents limits`、Node 22 下 `verify.ts` 拒绝运行均符合预期。
- 2026-11-05：`v2.12.7`（`05a4eb5`）发布，本机已更新；验证阶梯合入 `e4b7941`（`verify.ts` 拒绝旧 Node、分支 CI、发版步骤）；新增 D-186 与 `rules/FAILURE_LEDGER.md` 记录非本次改动导致的失败；本机 TCP 动态端口范围改回 49152 起（home-lab-ops `85b9a1f`）；个人 harness 增加“一会话一交付”。
- 2026-11-05：工具调用防护与 per-agent 模型调用预算已接入；聚焦 E2E 27/27、`pnpm check:schema` 和新增文档链接/空白检查通过；完整 `pnpm preflight` 遇到禁用端口失败。实际 Windows 公开形状扫描输出 `no private list + 2 shapes`。测试临时目录确认无外部进程后已清理。旧候选 `1965388c` verify 失败；E2E 修复已在 `05a4eb5` 推送，新 verify `42013816772` 当时仍在运行；未发布。细节见 decision 0001。
- 2026-11-05：本地验证流程改进提交 `324efab04` 留在 `docs/local-verification-loop` worktree/分支，未推送；基准与配套规则决策仍待处理。
- 2026-11-05：上下文压缩提案提交 `0ea8af634` 仅在 `fix/tool-finalization` 历史中，不在当前 `master`；取舍待决定。
- 2026-11-04：上游同步发布 `v2.12.6` 成功，commit `1febcd69246c`；性能预算例外未修改。
