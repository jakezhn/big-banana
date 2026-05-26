# Web Docs

`apps/web/docs/` 专门服务于网站内容本身，而不是后端工程设计。

## 这里应该放什么

- 页面信息架构
- 页面模块草图
- 页面文案与语气规范
- 用户引导内容
- FAQ / 帮助中心草稿
- legal / disclosure / risk notice 页面规划
- dashboard 页面内容约束

## 这里不应该放什么

- 数据库设计
- agent / risk / execution 架构
- Supabase / Vercel / Inngest 部署方案
- schema 冻结规格
- 后端联调 runbook

这些内容应继续留在根目录的 `docs/development/`。

## 当前文档

- `information-architecture.md`
  - MVP 前端页面地图、用户角色、页面职责、范围边界。
- `dashboard-design-system.md`
  - 当前 dashboard 的视觉方向、布局规则、组件规则、响应式约束。
- `mvp-implementation-audit.md`
  - 当前实现是否合理、哪些地方还不够好、下一轮实现优先级。

建议阅读顺序：

1. `information-architecture.md`
2. `dashboard-design-system.md`
3. `mvp-implementation-audit.md`

## 暂不创建的文档

以下文档只有在对应功能进入开发时再创建，避免 MVP 阶段提前维护空文档：

- `dashboard-content-model.md`
- `marketing-pages.md`
- `help-center.md`
- `legal-pages.md`

当前阶段以前端内部 dashboard 为主，不做 marketing / help center / legal 页面设计。
