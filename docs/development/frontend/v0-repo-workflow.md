# v0 Repo Workflow

这份文档服务的场景是：

- `v0` 不是只产出页面草图
- 而是直接接入当前仓库，在现有前端基础上继续开发

## 当前判断

现有输入包已经足够支持：

- prompt-only 页面生成
- `v0` 只输出组件/页面方案

但如果要让 `v0` 直接连接当前仓库，这些上下文还不够。  
还必须补齐：

- monorepo 结构
- 前端真实入口路径
- 明确的编辑白名单
- 分支工作流
- `Codex` 后续接回方式

## 当前仓库结构里，v0 应该理解什么

这个仓库是一个 `pnpm` monorepo。

与本轮前端开发直接相关的部分只有：

```txt
apps/web/
  app/
    page.tsx
    pipelines/page.tsx
    agent-runs/page.tsx
    markets/[marketKey]/page.tsx
    globals.css
    layout.tsx
  src/
    api/get-api-base-url.ts
    dashboard/load-dashboard-data.ts
```

可以把它理解成：

- `apps/web/app/*`
  - 页面入口
- `apps/web/src/dashboard/*`
  - 页面读取真实数据的前端读层
- `apps/web/app/globals.css`
  - 全局样式

## v0 的工作范围

### 允许编辑

`v0` 只应编辑：

```txt
apps/web/app/**
apps/web/src/components/**
apps/web/src/dashboard/**
apps/web/src/styles/**
apps/web/app/globals.css
docs/development/frontend/**
```

其中：

- 如果需要新增组件目录，优先新增在 `apps/web/src/components/`
- 如果需要抽页面级 formatter / presentational helpers，可放在 `apps/web/src/dashboard/`

### 不允许编辑

`v0` 不应改动：

```txt
apps/api/**
apps/hermes/**
packages/**
scripts/**
docs/development/**   (frontend 子目录除外)
package.json          (除非明确要求补前端依赖)
pnpm-workspace.yaml
tsconfig*
supabase/**
```

原因：

- 后端 API、agent runtime、contracts、DB 层已经基本收尾
- 当前阶段的目标是继续做前端 UI/UX，而不是再扩后端骨架

## 分支工作流建议

推荐使用：

```txt
main
  稳定主线

ui/v0-agent-runs
  v0 做 Agent Runs 页面迭代

ui/v0-market-detail
  v0 做 Market Detail 页面迭代
```

建议规则：

- 一个 `v0` chat 只负责一个页面或一个很窄的 UI 任务
- 不要让一个 `v0` chat 同时改多个页面和全局结构
- `Codex` 后续从远端拉取 `v0` 分支结果，再做工程化收口

## 推荐协作顺序

### 1. 先由 Codex 准备输入包

使用：

- `v0-context-pack.md`
- `frontend-read-models.md`
- 对应页面 brief
- `v0-repo-prompts.md`

### 2. 再让 v0 直接在前端分支上开发

要求：

- 只改允许路径
- 保持数据字段名不变
- 不发明后端对象

### 3. 由 Codex 拉回并收口

`Codex` 负责：

- 检查 diff 是否超出工作范围
- 修 build / typecheck
- 接回真实读模型
- 修正和真实 API 不一致的部分

## 这个方法是否合适

合适，而且比反复复制粘贴更高效。

但前提是：

- `v0` 的工作范围要非常窄
- 每轮只做一个页面或一个页面的一部分
- `Codex` 继续掌握集成和回归

也就是说：

- `v0` 负责生成和推进 UI
- `Codex` 负责 repo 级质量控制

## 风险提醒

如果直接让 `v0` 接入整个 monorepo，又不给路径边界，最容易发生：

- 改到 `apps/api`
- 改到 `packages/*`
- 发明不存在的 domain 字段
- 过度重构目录
- 改动范围超过当前 UI 任务

所以 repo-mode 下最重要的不是“给更多上下文”，而是：

- 给更清楚的边界

