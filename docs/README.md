# Docs

`docs/` 现在只承担一类职责：**开发与运维文档**。

不要把未来网站面向用户的内容、页面文案、营销结构继续放在这里。  
那些内容应该跟具体应用一起维护，尤其是 `apps/web/docs/`。

## 文档边界

### `docs/development/`

这里放：

- 架构设计
- 冻结规格
- webhook / schema 协议
- 开发计划
- 工作进度
- 测试 / 联调 runbook
- 开发阶段需要长期维护的工程文档

这里不放：

- 网站页面文案
- 帮助中心内容草稿
- 营销页结构
- 页面级 SEO 文案

### `apps/web/docs/`

这里放：

- 网站信息架构
- 页面内容规划
- 页面文案与模块草稿
- 站点组件内容规则
- 后期的帮助中心、FAQ、legal content 规划

这样做的目的是：

- 根目录 `docs/` 保持工程文档纯度
- app 自己管理自己的内容文档
- 避免产品内容和开发文档混在一起

## 当前推荐阅读顺序

1. `development/mvp-freeze.md`
2. `development/webhook-payload-spec.md`
3. `development/mvp-architecture.md`
4. `development/mvp-validation-and-dashboard.md`
5. `development/mvp-work-tracker.md`
6. `development/paper-smoke-runbook.md`
