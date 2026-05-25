# Frontend Input Pack

这个目录只服务一个目标：

- 给 `v0` 提供稳定、收敛、可直接使用的前端输入包

不要把整个 repo 或全部开发文档直接扔给 `v0`。  
`v0` 最适合消费的是：

- 页面目标
- 当前前端实际数据形状
- 明确的约束
- 当前页面痛点
- 明确的 UI 任务边界

## 目录说明

| 文档 | 用途 |
|---|---|
| `v0-context-pack.md` | 总体使用说明；告诉 `v0` 这是什么产品、当前阶段做什么、不做什么 |
| `frontend-read-models.md` | 当前前端真正消费的数据对象和字段摘要 |
| `agent-runs-brief.md` | `Agent Runs` 页面目标、痛点、必须展示的信息、禁止发明的信息 |
| `market-detail-brief.md` | `Market Detail` 页面目标、痛点、必须展示的信息、禁止发明的信息 |
| `v0-repo-workflow.md` | `v0` 直接接入当前 monorepo 时的工作流、分支建议、编辑边界 |
| `v0-repo-prompts.md` | 可直接复制给 `v0` 的 repo-mode prompt，包括项目结构和工作范围 |

## 推荐给 v0 的最小输入集

第一轮只给：

1. `v0-context-pack.md`
2. `frontend-read-models.md`
3. `agent-runs-brief.md`

第二轮再给：

1. `v0-context-pack.md`
2. `frontend-read-models.md`
3. `market-detail-brief.md`

## 如果 v0 要直接接入仓库

仅靠上面三份文档还不够。  
还应额外给：

1. `v0-repo-workflow.md`
2. `v0-repo-prompts.md`

原因是 repo-mode 需要额外约束：

- 当前 monorepo 结构
- `v0` 允许编辑的路径
- `v0` 不允许改动的路径
- 分支和合并策略
- `Codex` 如何后续接回和工程化收口

## 不建议直接给 v0 的内容

- 整个后端 repo
- 所有 migrations
- 所有 domain 层实现
- 所有历史架构文档
- worker / queue / replay 的全部细节

这些内容对 `Codex` 有用，但对 `v0` 往往会造成噪音。

## Codex / v0 分工

`v0` 负责：

- 页面结构
- 视觉层级
- 信息密度
- 组件样式
- 响应式布局

`Codex` 负责：

- 把 v0 产物接回当前 `apps/web`
- 保持真实 API 和数据契约一致
- 处理类型、build、测试、回归
- 控制不让前端表达层污染领域逻辑
