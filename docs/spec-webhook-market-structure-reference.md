# Bitpunk Webhook Market Structure Reference

This document is a reference for reading `bitpunk.webhook.v4` as structured market-state context.

It is not a direct prompt template. It is intended to support prompt engineering, manual analysis, research workflows, and downstream execution logic.

The core goal is:

- treat the webhook as a multi-layer market-state snapshot
- distinguish conclusion fields from evidence fields
- analyze market structure in a stable order
- avoid overreacting to any single field

## 1. Design Intent

The webhook is not only a signal feed.

It is a compressed representation of the full indicator engine:

- high-level regime classification
- internal momentum and oscillator state
- signal context and trigger chain
- filter acceptance or rejection
- structural confirmation from swing levels, divergence, and VP nodes

In practical use, the payload should be read as a causal stack:

1. `regime` and `regime_raw` describe the broader market structure.
2. `momentum` and `osc` describe internal directional state and transitions.
3. `context` describes whether the market environment is fertile enough for a signal.
4. `trigger` describes what actually fired the setup.
5. `signal` describes how the engine currently classifies the opportunity.
6. `filter` explains why a candidate did or did not become actionable.
7. `structure`, `vp`, `divergence`, and `obos` refine trade quality and location.

## 2. Reading Hierarchy

The payload should be interpreted in this order:

1. `event`
2. `regime`
3. `regime_raw`
4. `momentum`
5. `osc`
6. `context`
7. `trigger`
8. `signal`
9. `filter`
10. `structure`
11. `vp`
12. `divergence`
13. `obos`

This order matters.

If the analysis starts from a local event such as `osc.bear_to_bull`, it is easy to overread a small local transition as a full structural reversal. The high-level market state should be established first, then refined downward.

## 3. Detailed Payload Structure

The webhook is a single JSON object with this top-level shape:

```json
{
  "schema_version": "bitpunk.webhook.v4",
  "event": {},
  "market": {},
  "signal": {},
  "trigger": {},
  "context": {},
  "regime": {},
  "regime_raw": {},
  "momentum": {},
  "osc": {},
  "filter": {},
  "structure": {},
  "vp": {},
  "divergence": {},
  "obos": {}
}
```

The payload should be understood as a layered state map, not as a flat field bag.

### 3.1 Top-Level Block Summary

- `schema_version`
  - current payload schema identifier
  - use this to branch downstream parsers when the structure changes

- `event`
  - compact summary of what happened on the current confirmed bar
  - best entry point for event-driven consumers

- `market`
  - instrument identity, timeframe, bar index, timestamp, and OHLCV
  - this is the environmental wrapper around the analytical state

- `signal`
  - multi-stage signal-engine output
  - includes candidate, final, and filtered actionable state

- `trigger`
  - ignition layer
  - explains what actually fired the setup and how fresh it is

- `context`
  - environmental support layer
  - describes whether the market is fertile enough for a directional signal

- `regime`
  - high-level structural classification
  - the primary directional lens for analysis

- `regime_raw`
  - raw regime evidence
  - EMA set, structural ordering, slope, location, expansion

- `momentum`
  - directional momentum state
  - strength, weakening transition, squeeze state

- `osc`
  - fast/slow oscillator alignment and local cross state

- `filter`
  - operational acceptance layer
  - explains why a candidate was allowed, blocked, or upgraded

- `structure`
  - relative high/low and structural bias references

- `vp`
  - volume profile reference structure
  - key volume-based locations and profile bounds

- `divergence`
  - divergence classification plus source geometry

- `obos`
  - overbought/oversold summary state

### 3.2 Typical Key Fields By Block

This is not a complete field dictionary. It is the field map that matters most for analysis.

- `event`
  - `type`
  - `direction`
  - `level`
  - `score`

- `market`
  - `symbol`
  - `tickerid`
  - `timeframe`
  - `timeframe_label`
  - `bar_index`
  - `bar_time`
  - `open`
  - `high`
  - `low`
  - `close`
  - `volume`

- `signal`
  - `bull_candidate`, `bear_candidate`
  - `bull_candidate_level`, `bear_candidate_level`
  - `bull_candidate_score`, `bear_candidate_score`
  - `bull_final_level`, `bear_final_level`
  - `bull_final_score`, `bear_final_score`
  - `bull_filtered_active`, `bear_filtered_active`
  - `bull_level`, `bear_level`
  - `bull_score`, `bear_score`
  - `bull_new_fire`, `bear_new_fire`
  - `bull_upgrade_fire`, `bear_upgrade_fire`

- `trigger`
  - `bull.active`, `bear.active`
  - `bull.momentum`, `bear.momentum`
  - `bull.oscillator`, `bear.oscillator`
  - `bull.upgrade_window`, `bear.upgrade_window`
  - `bull.trigger_score`, `bear.trigger_score`
  - `bull.resonance`, `bear.resonance`
  - `bull.mom_age`, `bear.mom_age`
  - `bull.osc_age`, `bear.osc_age`

- `context`
  - `bull.active`, `bear.active`
  - `bull.score`, `bear.score`
  - `bull.obos_units`, `bear.obos_units`
  - `bull.sqz_units`, `bear.sqz_units`
  - `bull.regime_assist_units`, `bear.regime_assist_units`
  - `bull.strong`, `bear.strong`

- `regime`
  - `code`
  - `name`
  - `changed`
  - `trend_score`
  - directional booleans for expansion, pullback, transition

- `regime_raw`
  - `ema20`, `ema50`, `ema100`, `ema200`
  - `stack20_50`, `stack50_100`, `stack100_200`
  - `stack_score`
  - `slope20`, `slope50`, `slope100`, `slope200`
  - `slope_score`
  - `loc20`, `loc50`, `loc100`, `loc200`
  - `location_score`
  - `sep1`, `sep2`, `sep3`
  - `expansion_score`
  - `trend_raw`
  - structural booleans such as `struct_bull`, `struct_bear`, `full_bull_stack`, `full_bear_stack`

- `momentum`
  - `value`
  - `scaled_value`
  - `is_bull`
  - `bull_strong`, `bear_strong`
  - `bull_state`, `bear_state`
  - `bull_strong_to_weak`, `bear_strong_to_weak`
  - `sqz_on`, `sqz_off`

- `osc`
  - `fast`
  - `slow`
  - `spread`
  - `bull_state`, `bear_state`
  - `bear_to_bull`, `bull_to_bear`
  - `obos_abs`

- `filter`
  - `bull_state`, `bear_state`
  - `bull_state_name`, `bear_state_name`
  - `bull_bars_since_fire`, `bear_bars_since_fire`
  - `bull_in_cooldown`, `bear_in_cooldown`
  - `bull_can_rearm`, `bear_can_rearm`
  - `bull_last_fire_bar`, `bear_last_fire_bar`
  - `bull_last_fire_level`, `bear_last_fire_level`
  - `bull_last_fire_score`, `bear_last_fire_score`
  - `bull_level_upgrade`, `bear_level_upgrade`
  - `bull_score_upgrade`, `bear_score_upgrade`
  - `bull_upgrade_candidate`, `bear_upgrade_candidate`
  - `bull_allow_pre`, `bear_allow_pre`
  - `bull_allow_post`, `bear_allow_post`

- `structure`
  - `relative_high`, `relative_low`
  - `relative_high_bar`, `relative_low_bar`
  - `rhl_bias`
  - `rhl_regime_bias`
  - `rhl_trend_bias`

- `vp`
  - `enabled`
  - `start_index`
  - `right_anchor_bar`
  - `profile_low`, `profile_high`
  - `price_step`
  - `poc_level`, `vah_level`, `val_level`
  - `poc_price`, `vah_price`, `val_price`
  - `peak_nodes`

- `divergence`
  - `regular_bull`, `regular_bear`
  - `hidden_bull`, `hidden_bear`
  - `regular_bull_new`, `regular_bear_new`
  - `hidden_bull_new`, `hidden_bear_new`
  - `bull_boost`, `bear_boost`
  - source bars, prices, and oscillator values for bull and bear legs

- `obos`
  - `side`
  - `level`
  - `bull_level`
  - `bear_level`
  - `entered_or_upgraded`

### 3.3 Structural Meaning Of The Payload Layout

The payload order itself reflects the intended reading model:

- `event` and `market` tell you what happened and where
- `signal`, `trigger`, and `context` describe the live directional decision stack
- `regime` and `regime_raw` provide broad structural context
- `momentum` and `osc` provide internal state evidence
- `filter` explains operational acceptance
- `structure`, `vp`, `divergence`, and `obos` qualify trade location and quality

So the payload is not random. It is already grouped by analysis role.

## 4. Three Classes Of Information

### 4.1 Conclusion Fields

These are the highest-level outputs of the engine:

- `event`
- `regime`
- filtered parts of `signal`

These answer:

- what happened on this bar
- what market regime the engine believes is active
- whether the signal engine accepted the setup

### 4.2 Evidence Fields

These explain why the engine reached those conclusions:

- `regime_raw`
- `momentum`
- `osc`
- `context`
- `trigger`
- parts of `signal`
- parts of `filter`

These answer:

- what the internal state actually looks like
- which directional components are aligned
- whether the signal emerged from strong evidence or weak evidence

### 4.3 Confirmation Fields

These help judge trade quality, structure, and location:

- `structure`
- `vp`
- `divergence`
- `obos`

These answer:

- whether the setup is occurring at a meaningful location
- whether structure confirms or contradicts the local directional thesis

## 5. Block-By-Block Interpretation

### 5.1 `event`

`event` is the summary of what happened on the current confirmed bar.

Typical examples:

- `signal.new`
- `signal.upgrade`
- `regime.change`
- `obos.change`
- `snapshot.close`

Interpretation guidance:

- `event` is the headline, not the whole story.
- A `signal.new` means a filtered actionable event occurred.
- A `signal.upgrade` means the same directional thesis strengthened after a prior fire.
- `snapshot.close` means no major event fired, but the payload is still a state snapshot.

Use `event.direction`, `event.level`, and `event.score` as a compact summary, but confirm them against the deeper blocks.

### 5.2 `market`

`market` gives the bar environment:

- symbol identity
- timeframe
- bar timestamp
- OHLCV

This block is not interpretive, but it is important context for any LLM or downstream system.

`timeframe_label` is especially useful for natural-language reasoning, while `timeframe` should be treated as the canonical raw value.

### 5.3 `regime`

`regime` is the engine's high-level structural label.

Important fields:

- `code`
- `name`
- `changed`
- `trend_score`

Interpretation guidance:

- `regime` should be treated as the primary structural lens.
- Positive `code` means bullish structure.
- Negative `code` means bearish structure.
- Zero implies neutral or compression conditions.
- `trend_score` is the regime engine's directional magnitude score.

This block is a conclusion layer, not raw evidence. If `regime` and local signals disagree, the disagreement itself is meaningful and should be analyzed rather than ignored.

### 5.4 `regime_raw`

`regime_raw` provides the raw evidence behind the regime engine:

- EMA set
- stack metrics
- slope metrics
- location metrics
- separation and expansion metrics
- price positioning booleans

Interpretation guidance:

- EMA stack fields describe directional ordering and structural alignment.
- slope fields describe directional persistence.
- location fields describe where price is sitting relative to the EMA set.
- expansion fields describe whether the trend is broadening or compressed.

When `regime.name` says one thing but `regime_raw` looks mixed, it usually means the structure is transitional or fragile.

### 5.5 `momentum`

`momentum` describes the directional momentum engine.

Important fields:

- `value`
- `scaled_value`
- `is_bull`
- `bull_strong`
- `bear_strong`
- `bull_state`
- `bear_state`
- `bull_strong_to_weak`
- `bear_strong_to_weak`
- `sqz_on`
- `sqz_off`

Interpretation guidance:

- `value` is the base momentum reading.
- `scaled_value` is the normalized momentum used by the broader engine.
- `is_bull` indicates sign direction.
- `bull_state` and `bear_state` are side-specific state encodings:
  - `2` = strong
  - `1` = weak
  - `0` = inactive on that side
- `bear_strong_to_weak` is a bullish trigger precursor.
- `bull_strong_to_weak` is a bearish trigger precursor.
- `sqz_on` means compression is active.
- `sqz_off` means squeeze release state is active.

Momentum is not a full signal on its own. It should be read as state and trigger substrate.

### 5.6 `osc`

`osc` describes the oscillator layer.

Important fields:

- `fast`
- `slow`
- `spread`
- `bull_state`
- `bear_state`
- `bear_to_bull`
- `bull_to_bear`
- `obos_abs`

Interpretation guidance:

- `fast > slow` means oscillator bull state.
- `fast < slow` means oscillator bear state.
- `spread` measures separation between the two lines.
- `bear_to_bull` means the oscillator just crossed from bearish alignment into bullish alignment.
- `bull_to_bear` means the opposite.

Very important:

- an oscillator cross is a local transition, not automatically a higher-timeframe reversal
- if `osc.bear_to_bull` appears inside a bearish regime, it may represent a local countertrend pop rather than a structural turn

### 5.7 `context`

`context` describes whether the environment is fertile enough for a directional signal.

Important fields:

- `active`
- `score`
- `obos_units`
- `sqz_units`
- `regime_assist_units`
- `strong`

Interpretation guidance:

- `context` is the soil in which signals can grow.
- `score` is the sum of the contextual components.
- `obos_units` reflects directional OBOS support.
- `sqz_units` reflects squeeze-state assistance.
- `regime_assist_units` reflects directional help from the regime layer.
- `strong` indicates a comparatively richer context.

`context.active` does not mean a trade should occur. It only means enough structural support exists for triggers to matter.

### 5.8 `trigger`

`trigger` describes what actually ignited the setup.

Important fields:

- side-level `active`
- `momentum`
- `oscillator`
- `upgrade_window`
- `trigger_score`
- `resonance`
- `mom_age`
- `osc_age`

Interpretation guidance:

- `momentum` and `oscillator` identify the specific trigger source.
- `upgrade_window` is crucial: oscillator triggers are only meaningful when they are allowed inside the same-direction upgrade window.
- `mom_age` and `osc_age` measure freshness.
- `resonance` reflects the short-term reinforcement effect of nearby trigger alignment.

Triggers are ignition, not permission. They still depend on context and filtering.

### 5.9 `signal`

`signal` is the main signal-engine output block.

It includes multiple stages:

- event stage
- candidate stage
- final stage
- filtered stage

Interpretation guidance:

- `candidate` fields represent raw eligible directional output before final operational filtering.
- `final` fields represent candidate output after divergence contribution is applied.
- filtered fields represent the actually accepted signal state after consolidation logic.

Most important actionable fields:

- `bull_filtered_active`
- `bear_filtered_active`
- `bull_level`
- `bear_level`
- `bull_score`
- `bear_score`
- `bull_new_fire`
- `bear_new_fire`
- `bull_upgrade_fire`
- `bear_upgrade_fire`

Research-important fields:

- candidate and final scores/levels

These help answer:

- whether a good setup existed
- whether it was accepted
- how filtering changed the final outcome

### 5.10 `filter`

`filter` explains why a candidate was accepted, held back, or upgraded.

Important fields:

- state and state name
- bars since fire
- cooldown flags
- rearm flags
- last fire bar / level / score
- level upgrade / score upgrade
- upgrade candidate
- allow pre / allow post

Interpretation guidance:

- `filter` is essential for understanding operational behavior.
- if `signal.candidate` exists but no new fire occurs, `filter` usually explains why.
- `allow_pre` shows whether the candidate was acceptable before bull/bear same-bar conflict resolution.
- `allow_post` shows whether it survived that final conflict resolution.
- `level_upgrade` means the current candidate level exceeds the last fire level.
- `score_upgrade` means the current candidate maintained the same level but improved enough in score to qualify as an upgrade candidate.

This block is especially important for research, debugging, and external replay logic.

### 5.11 `structure`

`structure` gives major structural references:

- relative high / low
- their bar indexes
- RHL bias values

Interpretation guidance:

- use this block to understand where price sits inside recent structure
- use relative high / low as structure anchors, not as standalone signals
- bias fields help interpret structural lean beyond raw price location

### 5.12 `vp`

`vp` contains volume profile references:

- profile boundaries
- POC / VAH / VAL levels and prices
- peak node array

Interpretation guidance:

- `peak_nodes` are useful structural locations for support, resistance, attraction, or congestion
- POC and value area levels are useful for market positioning and trade-location quality
- do not treat every VP node as equally important; proximity to current price and clustering matter

### 5.13 `divergence`

`divergence` contains both classification and source geometry.

Important fields:

- regular / hidden bull / bear flags
- new-event flags
- boost values
- source bar / price / osc coordinates

Interpretation guidance:

- divergence in this engine is confirmatory and score-adjusting
- it does not independently create a signal
- `bull_boost` and `bear_boost` show how much score support divergence contributed

### 5.14 `obos`

`obos` is the overbought / oversold summary layer.

Important fields:

- `side`
- `level`
- `bull_level`
- `bear_level`
- `entered_or_upgraded`

Interpretation guidance:

- `side` is the semantic direction of the OBOS condition
- `level` is the active severity
- side-specific levels show how the raw oscillator intensity maps into directional context
- `entered_or_upgraded` marks a new or stronger OBOS event

## 6. Recommended Market Structure Analysis Flow

### Step 1. Establish The Broad Structural Regime

Start with:

- `regime.code`
- `regime.name`
- `regime.changed`
- `regime.trend_score`

Then confirm with:

- `regime_raw.stack_*`
- `regime_raw.slope_*`
- `regime_raw.loc_*`
- `regime_raw.expansion_score`

Question to answer:

- Is the market structurally bullish, bearish, or neutral/compressed?

### Step 2. Check Internal Directional Alignment

Use:

- `momentum`
- `osc`

Question to answer:

- Is internal state aligned with the broad structure, or fighting it?

Examples:

- bullish regime + bullish momentum + bullish oscillator = aligned continuation environment
- bearish regime + bullish oscillator cross = possible countertrend or early transition

### Step 3. Check Whether The Environment Supports A Signal

Use:

- `context`

Question to answer:

- Is there enough contextual support for a meaningful setup, or is the market structurally thin?

### Step 4. Check The Trigger

Use:

- `trigger`

Question to answer:

- What actually caused the setup to ignite?
- Is the trigger fresh?
- Is it momentum-led, oscillator-led, or both?

### Step 5. Check Whether The Engine Accepted The Setup

Use:

- `signal`
- `filter`

Question to answer:

- Was there only a candidate?
- Did it become a new fire?
- Was it merely an upgrade?
- Was it blocked by cooldown or conflict resolution?

### Step 6. Refine By Structure And Location

Use:

- `structure`
- `vp`
- `divergence`
- `obos`

Question to answer:

- Is the event occurring in a structurally attractive place?
- Is there supporting divergence?
- Is the event stretched, crowded, or location-rich?

## 7. Conflict Handling Rules

Conflicts should not be ignored. They are often the most informative state.

### 7.1 Regime vs Oscillator Conflict

Example:

- bearish regime
- `osc.bear_to_bull = true`

Interpretation:

- this is often a local countertrend improvement, not a confirmed regime reversal
- treat it as a lower-level challenge to the broader bearish structure

### 7.2 Strong Context But No Signal

Example:

- `context.active = true`
- no `signal.new`

Interpretation:

- the market is fertile but not yet ignited
- triggers may be missing, stale, or rejected by filter logic

### 7.3 Candidate Exists But Filter Rejects

Example:

- `signal.bull_candidate = true`
- `signal.bull_new_fire = false`
- `filter.bull_allow_post = false`

Interpretation:

- the engine saw a directional opportunity
- but the operational logic did not accept it
- this is important for both execution and research

### 7.4 Signal Fires Against High-Level Regime

Example:

- `signal.bull_new_fire = true`
- `regime.code < 0`

Interpretation:

- this is usually a counter-structure trade
- it may still be valid, but should be treated as lower-confidence continuation and more tactical in nature

## 8. What An LLM Should Prioritize

If this webhook is used as LLM context, the model should prioritize:

1. broad structure before local triggers
2. filtered signal state before raw candidate state
3. evidence consistency over single-field excitement
4. structure quality before directional conviction

The model should avoid:

- treating every oscillator cross as a trend reversal
- treating every `new_fire` as equally high quality
- ignoring filter state
- ignoring regime-context disagreement

## 9. Suggested Output Shape For Analysis Systems

A good downstream analysis generated from this webhook should usually include:

- current structural regime
- internal alignment summary
- current signal state
- whether the event is continuation, pullback, transition, or countertrend
- structural support or contradiction from VP, divergence, and relative high/low
- main risks or uncertainty

This keeps the analysis anchored to the causal structure of the engine rather than to one isolated field.

## 10. Field Usage Guidance

### High-value for execution

- `event`
- `signal`
- `filter`
- `regime`
- `trigger`

### High-value for research and debugging

- `regime_raw`
- `momentum`
- `osc`
- `context`
- `divergence`

### High-value for trade location and quality

- `structure`
- `vp`
- `obos`

## 11. Final Principle

The best way to use this webhook is not:

- "find a bullish field and buy"

The correct use is:

- identify the broad market structure
- measure internal alignment
- confirm whether context exists
- identify the trigger
- verify that the signal engine accepted the setup
- confirm structural quality and location

This is the intended reading model for `bitpunk.webhook.v4`.
