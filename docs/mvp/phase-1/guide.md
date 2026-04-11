# Phase 1 Guide

这份文档定义 Bitpunk MVP 的 Phase 1 开发指南，并按“先把环境跑通，再写接入链路”的顺序组织。

Phase 1 的目标非常窄：

- 打通 TradingView webhook
- 通过 Supabase Edge Function 接收请求
- 完成 secret 校验、幂等处理、快速 ACK
- 把原始 payload 稳定写入 `raw_webhook_events`

Phase 1 不做：

- `bar_snapshots` 规范化
- OpenAI 分析
- 计划生成
- 计划评审
- 前端页面接入

但从工程结构上，Phase 1 就要把后续阶段要用的前端、后端和 AI 模块统一收进同一个 repo，避免后面重复迁移目录和环境变量。

如果本文与以下文档冲突，以这些文档为准：

- [`phase-0-freeze.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/phase-0-freeze.md)
- [`spec-webhook-ingestion.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/spec-webhook-ingestion.md)
- [`spec-supabase-postgres-schema.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/spec-supabase-postgres-schema.md)

---

# 1. Phase 1 完成标准

Phase 1 完成必须满足：

1. 正式 endpoint 可被 TradingView 调用
2. secret 校验生效
3. 重复请求不会写出第二条业务记录
4. 成功请求会写入 `raw_webhook_events`
5. 错误请求会返回统一错误格式
6. webhook 在 3 秒预算内稳定返回 ACK

---

# 2. 先准备什么

开始前先确认这 5 件事：

- 你有一个可用的 Supabase project
- 本机已安装并可执行 `supabase`
- 你能登录 Supabase CLI
- 你手里有 `TRADINGVIEW_WEBHOOK_SECRET`
- 你有一份真实或模拟的 `bitpunk.webhook.v9` payload

Phase 1 的硬阻塞对象只有一个：

- `raw_webhook_events`

如果你已经准备好了整套 schema，也可以一起建：

- `bar_snapshots`
- `analysis_cards`
- `trade_plans`
- `risk_plans`
- `plan_reviews`

但它们都不是 webhook 接入的阻塞项。

---

# 3. 单仓库工程原则

基于当前 MVP 规划，推荐采用单一 monorepo：

- 前端：`Next.js`
- 后端：`Supabase Postgres + Auth + Realtime + Edge Functions`
- AI 模块：repo 内共享代码，由 Supabase Edge Functions 调用

当前阶段不要做：

- 独立 `apps/api`
- 独立 AI worker 服务
- 多仓库拆分
- LangGraph 或多 agent 编排

原因：

- MVP 主链路已经冻结为 `TradingView Webhook -> Supabase Edge Function -> Postgres -> OpenAI -> Next.js Dashboard`
- 现在拆分服务只会增加环境变量、部署链路和本地联调复杂度
- 单仓库已经足够承载 Phase 1 到 Phase 4

---

# 4. 环境依赖总表

## 4.1 本地必须安装

至少安装：

- `git`
- `node`，建议 `20.9+`
- `pnpm`
- `supabase`
- Docker Desktop 或兼容运行时
- `curl`

可选但很实用：

- `ngrok` 或 `cloudflared`
- `deno`

说明：

- `supabase start` 依赖 Docker 或兼容运行时
- `pnpm` 用来管理 workspace，比把前端和共享包散着管要稳
- `ngrok` / `cloudflared` 只在你需要本地公网 webhook 测试时才需要
- `deno` 主要用于编辑器支持和本地调试 Supabase Edge Functions

## 4.2 云端依赖

至少准备：

- GitHub repo
- Supabase project
- Vercel project
- OpenAI API key
- TradingView alert source

说明：

- Phase 1 真正要接入的云端只有 Supabase 和 TradingView
- Vercel 和 OpenAI 虽然不是 Phase 1 的阻塞项，但工程结构上要提前预留

## 4.3 代码依赖分层

前端依赖：

- `next`
- `react`
- `react-dom`
- `typescript`
- `tailwindcss`
- `@supabase/supabase-js`

服务端 / AI 共享依赖：

- `openai`
- `zod`

建议：

- 共享类型、schema、AI 输出校验都放进 workspace 包
- 不要把 webhook schema、OpenAI schema、业务枚举复制进多个目录

---

# 5. 推荐项目结构

建议在当前 workspace 中整理为：

```txt
big-banana/
├── apps/
│   └── web/                     # Next.js 前端
├── packages/
│   ├── domain/                  # 共享常量、枚举、领域类型
│   ├── schemas/                 # webhook / AI 输出 schema
│   ├── ai/                      # prompt builder、输出解析、模型配置
│   ├── db/                      # 查询封装、数据映射
│   └── ui/                      # 可选，共享 UI 组件
├── supabase/
│   ├── config.toml
│   ├── migrations/              # 真正执行的 SQL migration
│   └── functions/
│       ├── _shared/             # Edge Function 共享工具
│       ├── webhook-tradingview/
│       ├── normalize-bar/
│       ├── analyze-event/
│       ├── generate-plan/
│       └── review-plan/
├── docs/
│   └── mvp/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
└── .gitignore
```

目录职责：

- `apps/web`：唯一前端应用
- `supabase/functions`：唯一后端入口层
- `packages/ai`：共享 AI 逻辑，不单独部署
- `packages/schemas`：统一放 webhook payload 和 OpenAI structured output 校验
- `packages/domain`：统一放对象名、枚举、常量、领域类型
- `packages/db`：统一放数据库读写映射

要求：

- 不要把核心业务逻辑散落在 `apps/web` 和 `supabase/functions` 两边各写一份
- 不要现在引入独立 `apps/api`
- 不要把 docs 里的 SQL 当运行时代码，尽快迁到真实 `supabase/migrations/`

---

# 6. 环境变量分层

不要只维护一个巨大的根目录 `.env`。建议分成 3 层：

## 6.1 根目录 `.env.example`

只做变量清单说明：

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
TRADINGVIEW_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL_ANALYSIS=
OPENAI_MODEL_PLAN=
OPENAI_MODEL_REVIEW=
```

## 6.2 `apps/web/.env.local`

只给前端和 Next.js server 使用：

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
```

## 6.3 `supabase/functions/.env`

只给 Supabase Edge Functions 使用：

```txt
TRADINGVIEW_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL_ANALYSIS=
OPENAI_MODEL_PLAN=
OPENAI_MODEL_REVIEW=
```

原则：

- 前端绝不能读取 `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` 不进入前端环境变量
- 本地和云端先保持同一份 `TRADINGVIEW_WEBHOOK_SECRET`

---

# 7. 从环境配置开始

这一节不是可选项。先把本地工具、项目绑定、本地环境变量、云端 secrets 全部打通，再进入 migration 和函数开发。

## Step 1. 安装基础工具

本机至少需要：

- `git`
- `node`
- `pnpm`
- `supabase`
- Docker Desktop 或兼容运行时
- `curl`

建议先确认以下命令都可用：

```bash
node --version
pnpm --version
supabase --version
docker --version
```

如果你还没装 Supabase CLI，可先按你自己的系统方式安装。安装完成后再确认：

```bash
supabase --version
```

验收点：

- 命令能正常执行
- 版本号能输出

## Step 2. 登录 Supabase CLI

先登录：

```bash
supabase login
```

验收点：

- CLI 登录成功
- 后续命令不再要求重复认证

## Step 3. 绑定当前仓库到 Supabase 项目

如果你打算按本指南落成单仓库，建议先把根目录基础文件准备好：

- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `.env.example`

如果仓库里还没有 `supabase/` 目录，先初始化：

```bash
supabase init
```

然后把当前仓库 link 到目标 project：

```bash
supabase link --project-ref <your-project-ref>
```

验收点：

- 仓库里存在 `supabase/` 目录
- 当前仓库已绑定到正确的 Supabase project

## Step 4. 创建推荐目录骨架

至少先建这些目录：

- `apps/web`
- `packages/domain`
- `packages/schemas`
- `packages/ai`
- `packages/db`
- `supabase/functions/_shared`

说明：

- Phase 1 虽然只落 webhook，但目录边界要先定好
- 这样到 Phase 2/3 时，不需要再大规模搬迁文件

## Step 5. 配置本地开发环境变量

Phase 1 必须配置：

```txt
TRADINGVIEW_WEBHOOK_SECRET
```

本地开发通常还会需要：

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Phase 1 不需要：

```txt
OPENAI_API_KEY
```

建议你至少维护两份本地环境文件：

```bash
touch .env.example
mkdir -p apps/web
cp supabase/functions/.env.example supabase/functions/.env
```

如果仓库里还没有模板文件，就自己建一份。`supabase/functions/.env` 至少填入：

```txt
TRADINGVIEW_WEBHOOK_SECRET=replace_me
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

`apps/web/.env.local` 预留：

```txt
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

要求：

- 不要把真实 secret 提交到 git
- 本地和云端先使用同一份 `TRADINGVIEW_WEBHOOK_SECRET`
- 不要把 `SUPABASE_SERVICE_ROLE_KEY` 暴露到前端

## Step 6. 配置 Supabase 云端 secrets

Edge Function 线上运行时必须能读取：

```txt
TRADINGVIEW_WEBHOOK_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

后续进入 AI 阶段时，还要补：

```txt
OPENAI_API_KEY
OPENAI_MODEL_ANALYSIS
OPENAI_MODEL_PLAN
OPENAI_MODEL_REVIEW
```

推荐直接用 CLI 设置：

```bash
supabase secrets set TRADINGVIEW_WEBHOOK_SECRET=replace_me
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

验收点：

- 本地开发环境可读取这些变量
- 云端 Edge Function 运行环境也可读取这些变量

## Step 7. 准备测试 payload

先准备一份最小可用 payload，后面本地和线上都复用它。

最低必须字段：

- `schema_version`
- `summary.market.tickerid`
- `summary.market.timeframe`
- `summary.market.bar_time`

示例：

```json
{
  "schema_version": "bitpunk.webhook.v9",
  "webhook_secret": "replace_me",
  "summary": {
    "market": {
      "tickerid": "BINANCE:BTCUSDT",
      "timeframe": "15",
      "bar_time": "2026-04-08T08:00:00Z"
    }
  }
}
```

验收点：

- 这份 payload 可以被后续 `curl` 和 TradingView 直接复用

---

# 8. 实施顺序

环境配置完成后，再进入正式实施。

## Step 8. 应用数据库 migration

先执行真实 Supabase migration。

最低要求：

- [`0001_phase0_base_schema.sql`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/supabase/migrations/0001_phase0_base_schema.sql)

建议一起执行：

- [`0002_phase0_rls.sql`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/supabase/migrations/0002_phase0_rls.sql)
- [`0003_phase0_views_and_realtime.sql`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/supabase/migrations/0003_phase0_views_and_realtime.sql)

如果你已把这些 SQL 放到仓库的 `supabase/migrations/` 下，可直接执行：

```bash
supabase db push
```

如果目前 migration 还只放在文档目录，就先把它们整理进真实的 `supabase/migrations/`，再执行 `supabase db push`。

验收点：

- `raw_webhook_events` 表已存在
- `raw_webhook_events_source_dedupe_key_uniq` 唯一索引已存在

## Step 9. 创建 Edge Function

新建 Supabase Edge Function：

```bash
supabase functions new webhook-tradingview
```

目标 endpoint 固定为：

```txt
POST /functions/v1/webhook-tradingview
```

不要在 Phase 1 引入：

- 多版本路由
- 多 webhook source
- 复杂中间件系统

## Step 10. 实现最外层 HTTP 校验

函数最先处理：

1. method 是否是 `POST`
2. `Content-Type` 是否为 `application/json`
3. body 是否可解析为 JSON object

返回规则：

- method 错误 -> `405`
- content-type 错误 -> `415`
- JSON 无法解析 -> `422` 或 `400`

Phase 1 推荐统一按 contract 返回：

- `401`
- `405`
- `415`
- `422`
- `500`

## Step 11. 实现 secret 校验

secret 读取优先级固定为：

1. `x-bitpunk-webhook-secret`
2. body 顶层 `webhook_secret`

校验逻辑：

- 服务端 secret 未配置 -> `500`
- 请求未带 secret -> `401`
- secret 不匹配 -> `401`

不要：

- 从 query string 读取 secret
- 打印 secret 到日志

## Step 12. 实现最低 payload 校验

当前只接受：

- `schema_version = bitpunk.webhook.v9`

最低必须字段：

- `schema_version`
- `summary.market.tickerid`
- `summary.market.timeframe`
- `summary.market.bar_time`

处理规则：

- 缺字段 -> `422`
- schema version 不支持 -> `422`

## Step 13. 构造 dedupe_key

规则固定为：

```txt
tradingview:{tickerid}:{timeframe}:{bar_time}
```

字段来源：

- `tickerid = summary.market.tickerid`
- `timeframe = summary.market.timeframe`
- `bar_time = summary.market.bar_time`

明确不要使用：

- `bar_index`

## Step 14. 只写 `raw_webhook_events`

Phase 1 入库只做一件事：

- 写 `raw_webhook_events`

写入字段：

- `source = 'tradingview'`
- `schema_version`
- `dedupe_key`
- `received_at`
- `raw_payload`
- `ingest_status = accepted`
- `error_message = null`

说明：

- Phase 1 不同步写 `bar_snapshots`
- Phase 1 不调用 normalizer
- Phase 1 不调用 OpenAI

## Step 15. 实现重复请求处理

唯一约束依据：

- `(source, dedupe_key)`

处理规则：

- 首次请求 -> 插入成功，返回 `200 accepted`
- 重复请求 -> 不新建第二条记录，返回 `200 duplicated`

建议做法：

- 直接依赖数据库唯一索引
- 捕获 unique violation
- 将该错误映射成幂等成功

## Step 16. 实现 ACK 响应

成功返回：

```json
{
  "ok": true,
  "status": "accepted",
  "dedupe_key": "tradingview:BINANCE:BTCUSDT:240:2026-04-08T08:00:00Z"
}
```

重复返回：

```json
{
  "ok": true,
  "status": "duplicated",
  "dedupe_key": "tradingview:BINANCE:BTCUSDT:240:2026-04-08T08:00:00Z"
}
```

失败返回：

```json
{
  "ok": false,
  "error": {
    "code": "invalid_payload",
    "message": "Missing summary.market.bar_time"
  }
}
```

## Step 17. 加结构化日志

Phase 1 至少记录这些日志字段：

- `component = webhook_ingestion`
- `source = tradingview`
- `stage`
- `result`
- `http_status`
- `error_code`
- `message`
- `request_id`
- `schema_version`
- `dedupe_key`
- `received_at`

推荐 `stage`：

- `authenticate`
- `parse_json`
- `validate_payload`
- `persist_raw`
- `respond`

---

# 9. 本地联调

## Step 18. 本地启动函数

本地调试时，先启动 Supabase 本地环境或至少启动 function 服务。你需要保证函数能读取到前面配置的环境变量。

常见方式：

```bash
supabase start
supabase functions serve webhook-tradingview --env-file supabase/functions/.env
```

如果你的本地流程不依赖完整本地栈，也至少确保：

- function 可以启动
- function 能拿到 `TRADINGVIEW_WEBHOOK_SECRET`
- function 能访问目标数据库

## Step 19. 用 `curl` 跑最小测试集

本地至少做以下 5 组测试：

1. 正常 payload -> `200 accepted`
2. 同一 payload 连发两次 -> 第二次 `200 duplicated`
3. secret 错误 -> `401`
4. 缺 `summary.market.bar_time` -> `422`
5. 错误 `Content-Type` -> `415`

示例：

```bash
curl -i \
  -X POST \
  http://127.0.0.1:54321/functions/v1/webhook-tradingview \
  -H 'content-type: application/json' \
  -H 'x-bitpunk-webhook-secret: replace_me' \
  --data @payload.json
```

如果你有 tunnel：

- 用真实公网地址测一遍更好

---

# 10. 部署与实测

## Step 20. 部署到 Supabase

部署顺序：

1. 部署 function
2. 配 secrets
3. 拿到正式 endpoint
4. 用 `curl` 再跑一遍本地同样的 5 组测试

常见命令：

```bash
supabase functions deploy webhook-tradingview
```

## Step 21. 接 TradingView

将 TradingView alert webhook 指向：

```txt
POST /functions/v1/webhook-tradingview
```

secret 优先方案：

- header `x-bitpunk-webhook-secret`

如果配置不方便：

- body 顶层 `webhook_secret`

然后验证：

- TradingView 能收到 200
- Supabase 中能查到对应 `raw_webhook_events`

## Step 22. 验收

Phase 1 通过的标准：

- webhook 可公网访问
- 正常请求成功写入 raw 表
- 重复请求幂等
- 错误请求有统一响应
- 函数不做多余工作，ACK 足够快

---

# 11. 推荐开发顺序

推荐你按这个顺序推进：

1. 本机工具可用
2. Supabase project 绑定完成
3. 本地 env 与云端 secrets 配齐
4. migration 落库
5. function 骨架
6. method/content-type 校验
7. secret 校验
8. payload 最低字段校验
9. dedupe_key
10. raw insert
11. duplicate handling
12. response formatter
13. logging
14. local test
15. deploy
16. TradingView live test

这样最稳，因为每一步都能单独验证。

---

# 12. 本阶段不要扩张

Phase 1 常见跑偏点：

- 一上来就写 normalizer
- 一上来就接 OpenAI
- 想把 webhook 做成大而全 orchestrator
- 把前端联调也塞进来
- 为 future 扩展过度设计

这些都先不要做。

Phase 1 的判断标准不是“系统多完整”，而是：

- 接得稳不稳
- 幂等对不对
- ACK 快不快
- raw 数据落没落进去

---

# 13. 交付物清单

Phase 1 结束时，至少应有：

- 已执行的 Supabase migration
- `webhook-tradingview` Edge Function
- 可复用的 dedupe_key 构造逻辑
- 可复用的错误响应格式
- 本地测试 payload
- 一次成功的 TradingView 实测记录

---

# 14. 下一阶段入口

Phase 1 完成后，才进入 Phase 2：

- 从 `raw_webhook_events` 生成 `bar_snapshots`
- 把 raw payload 规范化成 AI 和前端可直接消费的结构

也就是说，Phase 1 的输出就是：

- 一个稳定的 raw ingestion layer
