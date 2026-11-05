# 文档地图

<!-- 模板：obsidian_data/templates/repo/docs-readme.md。本页只做导航；状态以各文档 frontmatter 为准，变更时同步本表。 -->

- [进度入口](PROGRESS.md)：当前状态、下一步、验证命令。

## 决策索引

| # | 标题 | 状态 | 一句话决定 |
| --- | --- | --- | --- |
| [0001](decisions/0001-tool-call-safeguards-and-model-call-budgets.md) | 防止无效工具调用并限制长运行模型成本 | active | 在 APX 原生 harness 边界校验工具批次，并为每个 agent 设置可选的单次 run 模型调用上限；已随 v2.12.7 发布，research agent 限额待设置。 |

## 其他文档

- `runbooks/`：可重复操作与回滚（按需）。
- `research/`：跨多份 decision 复用的来源与选项（按需）。
- `specs/`、`plans/`：标准生效前的旧文档（只读；再次活跃时改写为 decision）。
