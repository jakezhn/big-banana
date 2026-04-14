# Webhook Ingestion Contract

这份文档定义 Bitpunk MVP 在 Phase 0 的 TradingView webhook 接入契约。

目标是把以下部分定死：

- endpoint
- request requirements
- secret 校验
- ACK 语义
- 重复请求处理
- 入库规则
- 错误日志格式

如果本文与以下文档冲突，以本文为准：

- [`phase-0-freeze.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/phase-0-freeze.md)
- [`spec-webhook-payload.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/spec-webhook-payload.md)
- [`spec-supabase-postgres-schema.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/spec-supabase-postgres-schema.md)

---

# 1. 目标

Phase 0 的 ingestion 目标只有 3 个：

1. 稳定接收 TradingView 的 confirmed-close payload
2. 在 3 秒预算内快速返回 ACK
3. 把 raw event 可靠写入 `raw_webhook_events`

Phase 0 的 ingestion 不负责：

- 复杂编排
- 长事务
- 同步调用 Foundry
- 同步生成 plan
- 多来源 webhook 兼容

---

# 2. Endpoint

正式接入 endpoint 冻结为：

```txt
POST /functions/v1/webhook-tradingview
```

说明：

- 这是 Supabase Edge Function 暴露的单一入口
- Phase 0 不引入多版本路由
- Phase 0 不引入 `/v1`、`/v2` 子路径

请求要求：

- method 必须是 `POST`
- `Content-Type` 必须是 `application/json`
- body 必须是合法 JSON object

推荐请求头：

- `content-type: application/json`
- `x-bitpunk-webhook-secret: <secret>`

说明：

- TradingView 自定义 header 的可用性可能受配置方式限制
- 如果 header 不方便注入，则允许 secret 放在 body 顶层字段中

---

# 3. Secret 校验

## 3.1 支持的 secret 位置

Phase 0 按以下优先级读取 secret：

1. `x-bitpunk-webhook-secret` header
2. body 顶层 `webhook_secret`

不允许：

- query string 传 secret
- 同时接受多个不同 secret 字段名

## 3.2 服务端环境变量

Supabase Edge Function 必须配置：

```txt
TRADINGVIEW_WEBHOOK_SECRET
```

## 3.3 校验规则

校验规则冻结为：

- 如果服务端 secret 未配置，直接视为服务端错误
- 如果请求未带 secret，返回 `401`
- 如果 secret 不匹配，返回 `401`
- secret 匹配后才进入 payload 校验与入库

Phase 0 不做：

- HMAC 签名
- 时间戳防重放签名
- IP allowlist

---

# 4. Payload 接收边界

## 4.1 接收版本

当前只接收：

- `schema_version = bitpunk.webhook.v9`

如果 schema_version 缺失或不受支持：

- 返回 `422`
- `raw_webhook_events` 仍可记录一条 `rejected` 事件，方便排错

## 4.2 最低字段要求

Phase 0 要求 payload 至少包含：

- `schema_version`
- `summary.market.tickerid`
- `summary.market.timeframe`
- `summary.market.bar_time`

如果缺少这些字段：

- 返回 `422`
- 视为不可规范化 payload

## 4.3 去重键

业务去重键冻结为：

```txt
tradingview:{tickerid}:{timeframe}:{bar_time}
```

字段来源：

- `tickerid = summary.market.tickerid`
- `timeframe = summary.market.timeframe`
- `bar_time = summary.market.bar_time`

---

# 5. ACK 语义

## 5.1 成功 ACK

只要满足以下条件，就返回成功 ACK：

- secret 校验通过
- body 是合法 JSON
- 能提取出最低必需字段
- `raw_webhook_events` 成功写入，或被确认为重复事件

成功返回：

- HTTP `200`

响应 body：

```json
{
  "ok": true,
  "status": "accepted",
  "dedupe_key": "tradingview:BINANCE:BTCUSDT:240:2026-04-08T08:00:00Z"
}
```

或：

```json
{
  "ok": true,
  "status": "duplicated",
  "dedupe_key": "tradingview:BINANCE:BTCUSDT:240:2026-04-08T08:00:00Z"
}
```

说明：

- `duplicated` 仍然返回 `200`
- 对 TradingView 来说，重复请求不是错误，只是幂等重放

## 5.2 失败 ACK

返回规则冻结为：

- `401`：secret 缺失或不匹配
- `405`：method 不正确
- `415`：content-type 不支持
- `422`：JSON 合法但 schema 不满足最低要求
- `500`：服务端错误，如数据库写入失败、环境变量缺失

失败返回统一格式：

```json
{
  "ok": false,
  "error": {
    "code": "invalid_payload",
    "message": "Missing summary.market.bar_time"
  }
}
```

---

# 6. 重复请求处理

## 6.1 幂等原则

对于同一个：

- `source = tradingview`
- `dedupe_key`

系统必须幂等。

## 6.2 数据库判定

数据库唯一约束：

- `raw_webhook_events (source, dedupe_key)` 唯一

处理规则：

- 首次请求：插入一条 `ingest_status = accepted`
- 重复请求：不新建业务记录，返回 `status = duplicated`

## 6.3 是否记录重复请求

Phase 0 冻结为：

- 不额外写第二条 `raw_webhook_events`
- 唯一约束冲突即视为已处理成功

原因：

- 保持 raw table 清晰
- 避免重复脏数据
- 后续如果确实要统计 provider retry，再单独加 ingestion audit log

---

# 7. 入库规则

## 7.1 `raw_webhook_events`

写入时机：

- secret 校验通过后
- 且 body 可解析为 JSON object

写入字段：

- `source = 'tradingview'`
- `schema_version`
- `dedupe_key`
- `received_at = now()`
- `raw_payload`
- `ingest_status`
- `error_message`

状态规则：

- 成功接收并写入：`accepted`
- payload 无法继续处理但仍需落审计：`rejected`
- 唯一键冲突：不新增行，逻辑上视为 `duplicated`

## 7.2 `bar_snapshots`

Phase 0 ingestion contract 不要求同步写入 `bar_snapshots`。

推荐做法：

1. ingestion function 只写 `raw_webhook_events`
2. 后续 normalizer 再写 `bar_snapshots`

原因：

- 把 ACK 路径压到最短
- 降低 webhook timeout 风险
- 保持 ingestion 和 normalization 解耦

---

# 8. 错误日志格式

## 8.1 日志目标

Phase 0 的错误日志要满足：

- 能快速定位失败类别
- 能找到对应 request
- 不泄露 secret

## 8.2 统一日志字段

推荐日志对象：

```json
{
  "component": "webhook_ingestion",
  "source": "tradingview",
  "stage": "validate_payload",
  "result": "error",
  "http_status": 422,
  "error_code": "missing_required_field",
  "message": "Missing summary.market.bar_time",
  "request_id": "uuid-or-runtime-id",
  "schema_version": "bitpunk.webhook.v9",
  "dedupe_key": "tradingview:BINANCE:BTCUSDT:240:2026-04-08T08:00:00Z",
  "received_at": "2026-04-08T08:00:01Z"
}
```

## 8.3 `stage` 枚举

推荐 `stage`：

- `authenticate`
- `parse_json`
- `validate_payload`
- `persist_raw`
- `respond`

## 8.4 `error_code` 枚举

推荐 `error_code`：

- `missing_secret`
- `invalid_secret`
- `invalid_content_type`
- `invalid_json`
- `unsupported_schema_version`
- `missing_required_field`
- `database_write_failed`
- `server_misconfigured`

## 8.5 脱敏规则

日志中禁止输出：

- 完整 secret
- 完整 authorization header

允许输出：

- `schema_version`
- `tickerid`
- `timeframe`
- `bar_time`
- `dedupe_key`

---

# 9. 参考处理流程

```txt
1. Check method
2. Check content-type
3. Parse JSON body
4. Read secret from header/body
5. Compare with TRADINGVIEW_WEBHOOK_SECRET
6. Validate minimum payload fields
7. Build dedupe_key
8. Insert raw_webhook_event
9. If unique conflict, return duplicated ACK
10. Return 200 accepted ACK
```

---

# 10. 伪代码

```ts
if (req.method !== "POST") {
  return 405
}

if (!isJson(req)) {
  return 415
}

const payload = await parseJson(req)
const secret = readSecret(req.headers, payload)

if (!env.TRADINGVIEW_WEBHOOK_SECRET) {
  return 500
}

if (!secret) {
  return 401
}

if (secret !== env.TRADINGVIEW_WEBHOOK_SECRET) {
  return 401
}

validateMinimumPayload(payload)

const dedupeKey = buildDedupeKey(payload)

try {
  insert raw_webhook_events(...)
  return 200 accepted
} catch (e if isUniqueViolation) {
  return 200 duplicated
} catch (e) {
  return 500
}
```

---

# 11. Phase 0 定案

进入 Phase 1 前，以下内容视为已冻结：

- endpoint 是 `POST /functions/v1/webhook-tradingview`
- secret 只认 header `x-bitpunk-webhook-secret` 或 body `webhook_secret`
- dedupe_key 规则固定为 `tickerid + timeframe + bar_time`
- 重复请求返回 `200 duplicated`
- ingestion 只保证 `raw_webhook_events` 写入
- error response 与 error log 都使用统一格式
