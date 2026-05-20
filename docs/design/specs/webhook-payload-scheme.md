# Bitpunk Webhook Payload Spec

## 1. 用途

`webhookPayload` 是发给下游交易决策 agent 的 bar close 状态包。

它主要回答两个问题：

1. 当前市场处于什么状态？
2. 如果这根 confirmed bar 上出现了有效信号，这个信号有哪些值得决策使用的信息？

payload 不是订单指令。它只提供结构化的 market context 和 signal detail，真正的持仓、执行、风控决策仍由下游 agent 负责。

所有 payload 都只在 confirmed bar 之后发送。

## 2. Payload 类型

顶层 `type` 决定 agent 应该如何消费这份 payload。

### `snapshot`

```json
{
  "schema_version": "bitpunk.webhook.v12",
  "type": "snapshot",
  "context": {}
}
```

`snapshot` 只表示市场状态更新，不表示应该开仓。

推荐处理方式：

- 刷新 symbol / timeframe 对应的市场状态缓存。
- 更新 regime、structure、momentum、oscillator、volatility 等背景信息。
- 不要因为收到 `snapshot` 就创建新交易。

### `signal`

```json
{
  "schema_version": "bitpunk.webhook.v12",
  "type": "signal",
  "context": {},
  "signal": {}
}
```

`signal` 表示指标内部 filter 之后，当前 confirmed bar 上接受了一个有效 signal fire。它是交易候选，不是自动下单命令。

推荐处理方式：

- 先读 `signal`，理解当前候选交易本身。
- 再读 `context`，判断这个候选是否适合放在当前市场环境里执行。
- 最后再套用 agent 自己的账户、持仓、执行和风控规则。

## 3. 顶层契约

| 字段 | 含义 |
| --- | --- |
| `schema_version` | payload contract 版本。当前值为 `bitpunk.webhook.v12`。 |
| `type` | `signal` 或 `snapshot`。这是 agent 最先应该读取的字段。 |
| `context` | 每根 confirmed bar 都会提供的市场背景。 |
| `signal` | 仅在 `type == "signal"` 时出现。 |

agent 遇到未知 `schema_version` 时，应该拒收或隔离处理，而不是默认兼容。

## 4. 如何理解 `context`

`context` 描述的是当前市场环境。它是状态，不是交易建议。

### 4.1 `market`

```json
"market": {
  "tickerid": "BINANCE:BTCUSDT",
  "source": "BINANCE",
  "timeframe": "240",
  "timeframe_label": "4h"
}
```

用途：

- 确认 payload 是否属于允许交易的 symbol 和 venue。
- 确认 timeframe 是否属于当前策略范围。
- 用 `tickerid + timeframe` 作为最稳定的市场状态 key。

### 4.2 `bar`

```json
"bar": {
  "index": 12345,
  "time_ms": 1778404800000,
  "open": 67000,
  "high": 67800,
  "low": 66500,
  "close": 67400,
  "volume": 12345.6
}
```

用途：

- `close` 是当前 payload 对应的 confirmed price reference。
- `time_ms` 是 deduplication 最可靠的 bar identity。
- `index` 适合在单一 chart stream 内追踪顺序。

### 4.3 `volatility`

```json
"volatility": {
  "atr": 320.5,
  "atr_len": 14
}
```

用途：

- 做 ATR 归一化。
- 估算止损距离。
- 判断当前波动是否偏高或偏低。

`atr` 只是描述性输入，不直接规定杠杆或止损位置。

### 4.4 `regime`

```json
"regime": {
  "name": "Bull Pullback",
  "trend_score": 5.8
}
```

用途：

- `name` 描述当前宏观结构状态。
- `trend_score` 表示带方向的趋势强度。

`context.regime` 用来理解背景。若要判断某个具体 signal 是否顺势，更直接的字段是 `signal.regime_alignement`。

### 4.5 `structure`

```json
"structure": {
  "ema20": 67600,
  "ema50": 66800,
  "ema100": 65000,
  "ema200": 62000,
  "relative_high": 69000,
  "relative_low": 66000
}
```

用途：

- EMA 排列帮助判断趋势结构。
- `relative_high` / `relative_low` 帮助理解当前价格所处区间和潜在空间。
- 应和当前价格、ATR 一起用于评估入场位置与失效位置。

### 4.6 `momentum`

```json
"momentum": {
  "value": 18.2,
  "direction": "bull",
  "sqz": "off"
}
```

用途：

- `direction` 表示当前动量方向。
- `value` 表示动量幅度。
- `sqz` 表示当前是压缩还是释放状态。

momentum 是背景信息，不应被下游 agent 单独当成开仓 trigger。

### 4.7 `osc`

```json
"osc": {
  "fast": 54.1,
  "slow": 48.6,
  "spread": 5.5,
  "direction": "bull"
}
```

用途：

- `direction` 描述 fast / slow 的相对关系。
- `spread` 描述两者距离。

oscillator 适合解释当前短周期状态，但不应单独作为订单理由。

## 5. 如何理解 `signal`

`signal` 只会在当前 confirmed bar 上接受了有效 signal fire 时出现。

```json
"signal": {
  "direction": "long",
  "rank_level": 4,
  "rank_pct": 0.83,
  "regime": "pullback",
  "regime_alignement": "align",
  "kl": {
    "has_kl": true,
    "role": "support",
    "source": "EMA50"
  },
  "divergence": {
    "has_divergence": true
  },
  "gain": 0.61,
  "pain": 0.38,
  "proposed_size": 0.72
}
```

### 5.1 主要决策字段

| 字段 | 使用方式 |
| --- | --- |
| `direction` | 候选交易方向：`long` 或 `short`。 |
| `rank_level` | 1 到 4 的离散质量等级。它是理解信号强弱的第一入口。 |
| `rank_pct` | 概率层里的连续相对质量。用于区分同一 `rank_level` 内的强弱。 |
| `gain` | 历史样本中机会侧表现。越高通常越好，但不是保证收益。 |
| `pain` | 历史路径中的不适度或逆向压力。越高越需要保守。 |
| `proposed_size` | 指标内部根据概率和波动映射出的建议 size。适合作为输入或上限，不应直接替代账户级风控。 |

### 5.2 上下文修饰字段

| 字段 | 使用方式 |
| --- | --- |
| `regime` | 信号发生阶段：`expansion`、`pullback`、`transition`、`neutral`。 |
| `regime_alignement` | 信号方向与 regime 的关系：`align`、`counter`、`neutral`。字段名按 schema v12 的实际输出保留。 |
| `kl.has_kl` | 是否靠近已识别的 EMA key level。 |
| `kl.role` | `support`、`resistance` 或 `none`。 |
| `kl.source` | 当前 key level 来源，例如 `EMA50`。 |
| `divergence.has_divergence` | 这次 signal 是否带有 regular divergence 辅助。它只应作为支持证据。 |

## 6. 推荐的 Agent 消费流程

1. 校验 `schema_version`。
2. 读取顶层 `type`。
3. 按 `context.market.tickerid` 和 `context.market.timeframe` 做路由。
4. 用 `tickerid + timeframe + context.bar.time_ms + type` 去重。
5. 如果 `type == "snapshot"`，只更新市场状态，然后停止。
6. 如果 `type == "signal"`，先读取 `signal.direction`、`rank_level`、`rank_pct`。
7. 用 `gain`、`pain`、`proposed_size` 判断统计质量和风险接受度。
8. 用 `regime`、`regime_alignement`、`kl`、`divergence` 判断结构质量。
9. 用 `context.bar`、`context.volatility`、`context.structure` 计算实际 entry、invalid level 和真实下单 size。
10. 最后再经过账户风险、已有持仓、相关性暴露和 venue 执行规则。

## 7. 高效理解规则

这些是阅读捷径，不是固定交易规则。

### 更强的候选

- `rank_level >= 3`
- `gain >= 0.55` 
- `pain <= 0.45` 处于策略可接受范围
- `regime_alignement == "align"`
- `kl.has_kl == true` 可视为额外确认
- `divergence.has_divergence == true` 可视为额外确认

### 更需要谨慎的候选

- `rank_level <= 2`
- `pain >= 0.55` 
- `regime_alignement == "counter"`
- `regime == "transition"`

### 重要区分

- `snapshot` 是市场更新。
- `signal` 是交易候选。
- 两者都不是自动执行命令。

## 8. 常见误用

- `gain` 不是保证盈利概率。
- `pain` 不是最大可能亏损。
- `rank_level` 是压缩后的质量等级，不是绝对胜率。
- `rank_pct` 是相对质量，不是独立 edge estimate。
- `proposed_size` 不能替代账户级风控。
- `kl.has_kl` 不代表价格一定会在该位置反应。
- `divergence.has_divergence` 不应该成为唯一交易理由。
- `context.momentum` 和 `context.osc` 描述的是状态，不是下游 agent 的独立 trigger。

## 9. 示例 Payload

### Signal

```json
{
  "schema_version": "bitpunk.webhook.v12",
  "type": "signal",
  "context": {
    "market": {
      "tickerid": "BINANCE:BTCUSDT",
      "source": "BINANCE",
      "timeframe": "240",
      "timeframe_label": "4h"
    },
    "bar": {
      "index": 12345,
      "time_ms": 1778404800000,
      "open": 67000,
      "high": 67800,
      "low": 66500,
      "close": 67400,
      "volume": 12345.6
    },
    "volatility": {
      "atr": 320.5,
      "atr_len": 14
    },
    "regime": {
      "name": "Bull Pullback",
      "trend_score": 5.8
    },
    "structure": {
      "ema20": 67600,
      "ema50": 66800,
      "ema100": 65000,
      "ema200": 62000,
      "relative_high": 69000,
      "relative_low": 66000
    },
    "momentum": {
      "value": 18.2,
      "direction": "bull",
      "sqz": "off"
    },
    "osc": {
      "fast": 54.1,
      "slow": 48.6,
      "spread": 5.5,
      "direction": "bull"
    }
  },
  "signal": {
    "direction": "long",
    "rank_level": 4,
    "rank_pct": 0.83,
    "regime": "pullback",
    "regime_alignement": "align",
    "kl": {
      "has_kl": true,
      "role": "support",
      "source": "EMA50"
    },
    "divergence": {
      "has_divergence": true
    },
    "gain": 0.61,
    "pain": 0.38,
    "proposed_size": 0.72
  }
}
```

### Snapshot

```json
{
  "schema_version": "bitpunk.webhook.v12",
  "type": "snapshot",
  "context": {
    "market": {
      "tickerid": "BINANCE:BTCUSDT",
      "source": "BINANCE",
      "timeframe": "240",
      "timeframe_label": "4h"
    },
    "bar": {
      "index": 12346,
      "time_ms": 1778419200000,
      "open": 67400,
      "high": 68100,
      "low": 67100,
      "close": 67950,
      "volume": 11820.4
    },
    "volatility": {
      "atr": 318.2,
      "atr_len": 14
    },
    "regime": {
      "name": "Bull Expansion",
      "trend_score": 6.4
    },
    "structure": {
      "ema20": 67820,
      "ema50": 66940,
      "ema100": 65110,
      "ema200": 62090,
      "relative_high": 69200,
      "relative_low": 66540
    },
    "momentum": {
      "value": 22.7,
      "direction": "bull",
      "sqz": "off"
    },
    "osc": {
      "fast": 57.3,
      "slow": 50.1,
      "spread": 7.2,
      "direction": "bull"
    }
  }
}
```

## 10. 设计总结

这份 payload 有意拆成两层：

- `context` 负责告诉 agent 当前市场是什么样。
- `signal` 负责告诉 agent 当前是否出现了值得评估的 confirmed candidate。

下游 agent 的职责不是机械执行 payload，而是在这些信息之上完成真正的交易决策。
