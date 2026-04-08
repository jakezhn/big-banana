# Bitpunk Webhook Payload

本文档说明 [`src/bitpunkcore-dev.pine`](/Users/zzz/workspace/pine-playground/src/bitpunkcore-dev.pine) 当前实际输出的 webhook payload 结构。

当前脚本发出的 schema 版本是 `bitpunk.webhook.v9`。

这份文档关注三件事：

- payload 现在实际长什么样
- 每个字段在脚本里代表什么
- `summary` 和 `detail` 应该按什么顺序一起阅读

## 1. 发出条件

webhook 只有在以下条件同时满足时才会发出：

- `alert_webhookEnabled = true`
- `barstate.isconfirmed = true`

因此当前 payload 有两个重要特征：

- 只在确认收盘 bar 发出
- `summary.market.confirmed` 在实际发出的 payload 中始终是 `true`

## 2. 顶层结构

`bitpunk.webhook.v9` 的顶层结构如下：

```json
{
  "schema_version": "bitpunk.webhook.v9",
  "summary": {
    "market": {},
    "event": {},
    "regime": {},
    "structure": {}
  },
  "detail": {
    "signal": {},
    "context": {},
    "momentum": {},
    "osc": {},
    "divergence": {}
  }
}
```

可以把它理解成：

- `summary` 提供大纲
- `detail` 展示细节

两者都需要关注，但有先后顺序：

- 先读 `summary`
- 再用 `detail` 展开和修正判断

## 3. 推荐读取顺序

推荐按下面顺序读取：

1. `summary.market`
2. `summary.event`
3. `summary.regime`
4. `summary.structure`
5. 再进入 `detail`
6. 进入 `detail` 后依次看：
   - `detail.signal`
   - `detail.context`
   - `detail.momentum`
   - `detail.osc`
   - `detail.divergence`

这套顺序的含义是：

- `summary` 先给你当前局面的轮廓
- `detail` 再告诉你这个轮廓内部到底扎不扎实

## 4. Summary：大纲层

`summary` 包含四个 block：

- `market`
- `event`
- `regime`
- `structure`

它们回答的是：

1. 现在是什么市场、什么周期、哪根 bar
2. 当前确认 bar 的主事件是什么
3. 当前大结构处于什么状态
4. 当前价格离哪些关键结构最近

### 4.1 `summary.market`

`market` 包含：

- `symbol`
- `tickerid`
- `exchange`
- `timeframe`
- `timeframe_label`
- `bar_index`
- `bar_time`
- `confirmed`
- `open`
- `high`
- `low`
- `close`
- `volume`

这些字段主要用于定位分析语境。

需要特别注意：

- `timeframe`
  - TradingView 原始周期字段
  - 适合程序处理

- `timeframe_label`
  - 面向人类和 LLM 的简化周期标签
  - 例如 `15m`、`1h`、`4h`、`1d`

- `bar_index`
  - 图表内部相对编号
  - 适合调试和图内定位
  - 不适合跨图表做稳定主键

- `bar_time`
  - 使用 UTC 输出
  - 格式为 `yyyy-MM-ddTHH:mm:ssZ`
  - 跨系统对齐时优先使用它

- `confirmed`
  - 当前 emitter 只在确认 bar 发出 payload
  - 因此实际值总是 `true`

### 4.2 `summary.event`

`event` 包含：

- `type`
- `direction`
- `level`
- `score`

它回答的是：

- 当前这根确认 bar 最值得优先关注的事件是什么

#### `type`

当前脚本可能输出四种 `type`：

- `signal.new`
- `signal.upgrade`
- `obos.change`
- `snapshot.close`

它们按以下优先级选出单一事件：

1. `signal.new`
2. `signal.upgrade`
3. `obos.change`
4. `snapshot.close`

这意味着：

- 同一根 bar 上即使同时发生了信号和 OBOS 变化
- `event.type` 也会优先显示信号事件

#### `direction`

`direction` 可能是：

- `bull`
- `bear`
- `none`

其中：

- `bull` / `bear` 只在选中的事件是信号事件时出现
- `obos.change` 和 `snapshot.close` 会输出 `none`

#### `level` 与 `score`

- `level`
  - 仅对信号事件有值
  - 非信号事件时为 `null`

- `score`
  - 仅对信号事件有值
  - 非信号事件时为 `null`

#### 同 bar 双向冲突时如何取值

脚本不会在 `event` 里同时保留多空两个事件，而是只保留一侧：

- 先比 `level`
- `level` 相同再比 `score`
- 如果两者完全相同，`bull` 优先

因此 `summary.event` 应被理解为：

- 当前 bar 的主事件摘要
- 不是当前 bar 的完整事件列表

### 4.3 `summary.regime`

`regime` 包含：

- `name`
- `trend_score`

它们分别表示：

- 当前高层结构标签
- 当前趋势强度分数

`name` 的取值来自脚本当前 regime 命名，例如：

- `Bull Expansion`
- `Bull Pullback`
- `Bull Transition`
- `Bear Expansion`
- `Bear Pullback`
- `Bear Transition`
- `Neutral / Compression`

`trend_score` 是高层趋势强度的数值表达。

### 4.4 `summary.structure`

`structure` 包含：

- `ema20`
- `ema50`
- `ema100`
- `ema200`
- `relative_high`
- `relative_low`
- `peak_nodes`
- `trough_nodes`

这一层统一承载位置判断，不是在解释指标，而是在回答：

- 当前价格靠近哪些结构
- 是靠近支撑簇，还是阻力簇
- 是否存在结构共振

其中：

- `peak_nodes`
  - VP 的峰值节点数组
  - 可能为空数组 `[]`

- `trough_nodes`
  - VP 的谷值节点数组
  - 也可能为空数组 `[]`

## 5. Detail：细节层

`detail` 不是可选阅读区，而是细化判断区。

它的作用不是替代 `summary`，而是：

- 解释 `summary` 里的结论为什么成立
- 在大纲明确之后补全内部状态
- 在边缘 setup 中帮助判断应该继续等还是直接跳过

`detail` 包含：

- `signal`
- `context`
- `momentum`
- `osc`
- `divergence`

### 5.1 `detail.signal`

`signal` 的结构是：

- `bull.level`
- `bull.score`
- `bull.new_fire`
- `bull.update_fire`
- `bear.level`
- `bear.score`
- `bear.new_fire`
- `bear.update_fire`

它回答的是：

- 当前多头和空头各自的信号状态
- 每一侧当前分数和等级是多少
- 当前 bar 是否刚刚触发新信号或升级信号

需要注意：

- `level` 没有事件时通常是 `0`
- `score` 没有有效值时可能是 `null`
- `new_fire` 与 `update_fire` 是逐方向保存的
- 它比 `summary.event` 更完整，因为不会丢掉另一侧信息

### 5.2 `detail.context`

`context` 的结构是：

- `bull.active`
- `bull.score`
- `bull.strong`
- `bull.obos_units`
- `bull.sqz_units`
- `bull.regime_assist_units`
- `bull.htf_trend_assist_units`
- `bear.active`
- `bear.score`
- `bear.strong`
- `bear.obos_units`
- `bear.sqz_units`
- `bear.regime_assist_units`
- `bear.htf_trend_assist_units`

#### `active`

当前脚本中，`active` 不是“只要有点加分就算 active”，而是更严格：

- 该方向存在 `obos_units`
- 或者同时满足：
  - 当前是 `sqz = off`
  - 该方向 `regime_assist_units > 0`

这意味着：

- `htf_trend_assist_units` 单独存在时，不会让 `active = true`
- `score > 0` 也不等于 `active = true`

#### `score`

当前脚本中：

- `score = obos_units + sqz_units + regime_assist_units + htf_trend_assist_units`

也就是说：

- 它是环境厚度的合计值
- 明确包含 HTF assist

#### `strong`

当前脚本中：

- `obos_units >= 3.0`
- 或 `score >= 4.0`

满足任一条件即为 `strong = true`。

#### `obos_units`

表示来自 OBOS 拉伸的支持强度。

它来自 `f_obos_core_continuous(abs(osc_mainCore))`，不是简单离散 level。

大致规则是：

- 小于 `40` 时为 `0`
- 之后随强度连续抬升
- 上限压到 `5`

#### `sqz_units`

当前脚本里，`sqz_units` 只有一种正值来源：

- `sqz = off` 时给固定值 `0.90`

因此：

- 当前版本没有 `sqz on` 的正向 context 加分

#### `regime_assist_units`

这部分是高层结构顺风加分，当前常量为：

- 同向 `Bull/Bear Pullback`：`0.90`
- 同向 `Bull/Bear Expansion`：`0.50`
- 同向 `Bull/Bear Transition`：`0.35`
- 反向 assist：`0.00`
- `Neutral / Compression`：多空两边都是 `0.25`

#### `htf_trend_assist_units`

当前逻辑是：

- 高一级趋势快线在慢线上方时，多头得 `0.45`
- 高一级趋势快线在慢线下方时，空头得 `0.45`
- 否则为 `0.0`

它会影响 `score`，但不会单独激活 `active`。

#### 如何理解整个 `context`

可以把它压缩成一句话：

- `active` 看有没有形成土壤
- `score` 看土壤厚度
- `strong` 看厚度是否已经足够强
- 各种 `*_units` 看厚度来自哪里

### 5.3 `detail.momentum`

`momentum` 包含：

- `value`
- `sqz`
- `is_bull`
- `bull_strong_to_weak`
- `bear_strong_to_weak`

它回答的是：

- 当前动量值本身是多少
- squeeze 当前是 `off`、`on` 还是 `neutral`
- 当前动量偏多还是偏空
- 是否出现“强转弱”信号

其中：

- `sqz` 当前只会输出：
  - `off`
  - `on`
  - `neutral`

### 5.4 `detail.osc`

`osc` 包含：

- `fast`
- `slow`
- `spread`
- `bull_state`
- `bear_state`
- `bear_to_bull`
- `bull_to_bear`
- `obos_abs`
- `obos_entered_or_upgraded`

它回答的是：

- 快慢线当前如何排列
- 当前 bar 是否发生方向切换
- 当前 oscillator 拉伸强度如何
- 当前 bar 是否进入或升级了 OBOS

这里要特别注意：

- `obos_entered_or_upgraded = true` 只表示这件事发生了
- 不代表 `summary.event.type` 一定是 `obos.change`
- 因为 `event.type` 可能被更高优先级的信号事件覆盖

### 5.5 `detail.divergence`

`divergence` 包含：

- `regular_bull_triggered`
- `regular_bear_triggered`
- `hidden_bull_triggered`
- `hidden_bear_triggered`

它的角色是修正，不是主导：

- 提供延续或衰竭线索
- 增强或削弱当前 thesis
- 不适合脱离 `summary` 单独做方向判断

## 6. 当前 payload 示例

下面是与当前脚本一致的结构示例：

```json
{
  "schema_version": "bitpunk.webhook.v9",
  "summary": {
    "market": {
      "symbol": "BTCUSDT",
      "tickerid": "BINANCE:BTCUSDT",
      "exchange": "BINANCE",
      "timeframe": "240",
      "timeframe_label": "4h",
      "bar_index": 123456,
      "bar_time": "2026-04-08T08:00:00Z",
      "confirmed": true,
      "open": 65000.0,
      "high": 65200.0,
      "low": 64880.0,
      "close": 65120.0,
      "volume": 1234.5678
    },
    "event": {
      "type": "signal.new",
      "direction": "bull",
      "level": 2,
      "score": 4.15
    },
    "regime": {
      "name": "Bull Expansion",
      "trend_score": 7.1
    },
    "structure": {
      "ema20": 64980.0,
      "ema50": 64620.0,
      "ema100": 64110.0,
      "ema200": 63280.0,
      "relative_high": 65540.0,
      "relative_low": 64320.0,
      "peak_nodes": [64890.0, 65180.0],
      "trough_nodes": [64540.0, 63980.0]
    }
  },
  "detail": {
    "signal": {
      "bull": {
        "level": 2,
        "score": 4.15,
        "new_fire": true,
        "update_fire": false
      },
      "bear": {
        "level": 0,
        "score": null,
        "new_fire": false,
        "update_fire": false
      }
    },
    "context": {
      "bull": {
        "active": true,
        "score": 4.45,
        "strong": true,
        "obos_units": 2.8,
        "sqz_units": 0.9,
        "regime_assist_units": 0.5,
        "htf_trend_assist_units": 0.45
      },
      "bear": {
        "active": false,
        "score": 0.9,
        "strong": false,
        "obos_units": 0.0,
        "sqz_units": 0.9,
        "regime_assist_units": 0.0,
        "htf_trend_assist_units": 0.0
      }
    },
    "momentum": {
      "value": 18.2,
      "sqz": "off",
      "is_bull": true,
      "bull_strong_to_weak": false,
      "bear_strong_to_weak": true
    },
    "osc": {
      "fast": 54.1,
      "slow": 48.6,
      "spread": 5.5,
      "bull_state": true,
      "bear_state": false,
      "bear_to_bull": true,
      "bull_to_bear": false,
      "obos_abs": 54.1,
      "obos_entered_or_upgraded": false
    },
    "divergence": {
      "regular_bull_triggered": false,
      "regular_bear_triggered": false,
      "hidden_bull_triggered": false,
      "hidden_bear_triggered": true
    }
  }
}
```

## 7. 一句话心智模型

可以直接记成：

- `summary` 先给大纲
- `detail` 再给细节
- 两者都看，但先看 `summary`，再看 `detail`
