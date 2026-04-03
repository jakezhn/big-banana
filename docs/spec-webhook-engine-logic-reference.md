# Bitpunk Webhook Engine Logic Reference

This document explains the underlying logic behind `bitpunk.webhook.v4`.

It is a companion to the market-structure reference document:

- [spec-webhook-market-structure-reference.md](/Users/zzz/workspace/pine-playground/docs/spec/spec-webhook-market-structure-reference.md)

This document is not a prompt template and not a code walkthrough.

Its purpose is to help prompt engineering and downstream analysis systems understand:

- which modules are primary drivers
- which modules are supporting evidence
- which modules can trigger action
- which modules only confirm or refine a decision
- how the engine resolves conflict between bullish and bearish evidence

## 1. Core Principle

The engine does not think in one step.

It does not do:

- indicator value -> buy

It does:

1. classify broad structure
2. measure internal directional state
3. decide whether the environment is fertile enough
4. detect a trigger
5. score the setup
6. filter the setup operationally
7. refine the location and quality of the setup

This is the main logic to preserve when using the webhook as LLM context.

## 2. Engine Layers

The engine can be read as seven stacked layers.

### Layer 1. Structural Regime

This is the broad market map.

Primary blocks:

- `regime`
- `regime_raw`

This layer answers:

- is the market broadly bullish, bearish, or neutral
- is price structurally aligned with the EMA set
- is trend expanding, pulling back, or transitioning

This is the highest-priority layer for directional interpretation.

### Layer 2. Internal State

This is the internal directional condition of the market.

Primary blocks:

- `momentum`
- `osc`

This layer answers:

- is internal pressure bullish or bearish
- is internal state strengthening, weakening, or crossing
- is the move compressed or released

This layer refines the regime view, but does not replace it.

### Layer 3. Signal Context

This is the setup environment.

Primary block:

- `context`

This layer answers:

- does the current market state provide enough structural support for a directional signal to matter

Context is necessary but not sufficient.

### Layer 4. Trigger

This is the ignition layer.

Primary block:

- `trigger`

This layer answers:

- what caused the engine to consider acting now
- was the trigger momentum-led, oscillator-led, or both

A trigger without context is weak.

### Layer 5. Signal Construction

This is the decision layer.

Primary block:

- `signal`

This layer answers:

- was a candidate generated
- how strong was it
- did divergence improve it
- did it survive into a filtered actionable signal

### Layer 6. Operational Filter

This is the control layer.

Primary block:

- `filter`

This layer answers:

- was the candidate blocked by cooldown
- was it allowed before and after bull/bear conflict resolution
- was it accepted as a fresh fire or an upgrade

### Layer 7. Structural Confirmation

These are quality and location layers.

Primary blocks:

- `structure`
- `vp`
- `divergence`
- `obos`

These answer:

- is the setup happening in a meaningful location
- is there confirmation from price structure and volume structure
- is the market stretched or structurally supported

## 3. Causal Chain

The engine works conceptually like this:

1. `regime_raw` builds structural evidence
2. `regime` compresses that evidence into a structural label
3. `momentum`, `osc`, `obos`, and squeeze state create raw internal states
4. `context` converts structural environment into directional support units
5. `trigger` identifies an actual ignition event
6. `signal` scores the combined opportunity
7. `divergence` can improve signal quality, but cannot independently create a signal
8. `filter` decides whether the engine accepts the setup operationally
9. `structure`, `vp`, and `obos` refine location quality

That means:

- regime is upstream
- signal is downstream
- filter is not cosmetic, it is part of the final decision

## 4. Regime Logic

The regime engine is the broad structural classifier.

It uses:

- EMA stacking
- EMA slopes
- price location relative to the EMA set
- expansion and separation

From those, it classifies the market into:

- bull expansion
- bull pullback
- bull transition
- bear transition
- bear pullback
- bear expansion
- neutral / compression

Interpretation rule:

- `regime` should be treated as the dominant directional context
- lower layers may challenge it, but they should not automatically override it

Examples:

- bullish regime plus bullish momentum means directional alignment
- bearish regime plus bullish oscillator cross usually means local countertrend improvement, not automatic reversal

## 5. Momentum Logic

The momentum engine expresses directional pressure and strength state.

It distinguishes:

- sign direction
- strong vs weak state
- strong-to-weak transition
- squeeze on vs squeeze off

Important conceptual rule:

- momentum is both state and trigger substrate
- it is not the full trade decision

The strong-to-weak transition matters because this engine uses it as one of the trigger precursors.

Interpretation rule:

- strong bullish momentum supports continuation when the regime is bullish
- weakening bullish momentum inside a bullish regime may indicate pullback or transition risk
- squeeze release generally increases directional significance relative to squeeze-on compression

## 6. Oscillator Logic

The oscillator layer expresses internal fast/slow alignment.

Important concepts:

- `fast > slow` is bullish internal alignment
- `fast < slow` is bearish internal alignment
- `bear_to_bull` is a local bullish transition
- `bull_to_bear` is a local bearish transition

Interpretation boundary:

- oscillator crosses are local transitions
- they should not be interpreted as full structural reversals unless the higher regime evidence also shifts

The oscillator is especially useful for timing, but less reliable than regime for structural classification.

## 7. Context Logic

The context block is a directional support model.

It is built from:

- OBOS contribution
- squeeze contribution
- regime assist contribution

This means:

- context is not simply trend
- context is not simply momentum
- context is a directional environment score

Interpretation rule:

- high context means the market is fertile for a directional signal
- low context means a trigger may still happen, but it is structurally thinner

The most important distinction:

- context says whether a directional idea has environmental support
- trigger says whether something actually happened

## 8. Trigger Logic

The trigger layer is the event ignition model.

It currently uses:

- momentum trigger
- oscillator trigger

The trigger block should be read as:

- what actually fired now
- how fresh that trigger is
- whether it happened inside the allowed operational window

Important boundary:

- trigger is not permission by itself
- trigger without context is usually not enough

Also:

- oscillator trigger is operationally gated by the same-direction upgrade window
- that means a raw oscillator cross is not always a valid trigger in this engine

This is one of the key reasons why implementation logic matters for LLM interpretation.

## 9. Signal Logic

The signal block is multi-stage.

Conceptually it moves through:

1. candidate
2. final score after divergence contribution
3. filtered actionable state

This layered structure matters.

Interpretation rules:

- candidate fields show what the engine would like to do before operational filtering
- final fields show the score after divergence refinement
- filtered fields show what the engine actually accepts

This distinction is essential for research and debugging:

- a good candidate may exist without becoming an actionable signal
- a filtered signal is the operational truth

## 10. Divergence Logic

Divergence is supportive, not sovereign.

Its role in this engine is:

- improve score
- improve conviction
- provide structural confirmation

Its role is not:

- independently create a new trade signal

Interpretation rule:

- divergence should amplify or qualify a setup
- divergence should not replace regime, context, trigger, or filter

## 11. Filter Logic

The filter block is one of the most important parts of the system.

It governs:

- cooldown
- rearm
- upgrade acceptance
- same-bar bull/bear conflict resolution

Why this matters:

- many systems expose raw signal candidates and hide the fact that operational rules rejected them
- this engine exposes both, which is much better for research and replay

Interpretation rules:

- if a candidate exists but `allow_post` is false, the engine saw an opportunity but rejected it operationally
- if cooldown is active, a structurally valid idea may still be operationally suppressed
- upgrade flags mean the same directional thesis gained strength after a prior accepted fire

For any execution system, filtered state should dominate candidate state.

## 12. Structure, VP, And OBOS As Quality Layers

These blocks are not the core signal engine, but they matter heavily for plan quality.

### `structure`

Use it to answer:

- where is price relative to current relative high / low
- is the setup happening in extension, compression, or structural rotation

### `vp`

Use it to answer:

- where are meaningful volume nodes
- where is acceptance or congestion likely
- where might price react, pause, or be attracted

### `obos`

Use it to answer:

- whether the market is stretched
- whether contextual directional support is unusually rich

Important boundary:

- OBOS is not a standalone reversal command
- high OBOS should be treated as context and stretch, not automatic fade permission

## 13. Priority Rules

When modules disagree, use these priority rules.

### Rule 1. Regime Outranks Local Oscillator Cross

If regime is bearish and oscillator turns bullish:

- default interpretation is local bullish countertrend movement inside a bearish structure
- do not call it a new bullish structure unless regime evidence also improves

### Rule 2. Filtered Signal Outranks Candidate

If candidate and filtered state disagree:

- treat filtered state as the operational truth

### Rule 3. Context Outranks Trigger Freshness For Structural Legitimacy

A fresh trigger in weak context may be interesting, but structurally thin.

### Rule 4. Divergence Refines, It Does Not Govern

Use divergence to improve or weaken confidence, not to replace the broader causal chain.

### Rule 5. VP And Structure Refine Trade Quality, Not Direction By Themselves

They are location tools, not independent directional engines.

## 14. Common Misreadings To Avoid

### Mistake 1

Reading `osc.bear_to_bull` as full market reversal.

Correct reading:

- local bullish internal transition
- verify against regime and context

### Mistake 2

Reading `context.strong` as trade permission.

Correct reading:

- strong environment
- still needs trigger and acceptance

### Mistake 3

Reading candidate score as final actionable signal.

Correct reading:

- candidate is pre-operational
- filtered state decides actual actionability

### Mistake 4

Treating OBOS as direct reversal instruction.

Correct reading:

- OBOS indicates stretch and context, not guaranteed turning point

### Mistake 5

Treating VP nodes as unconditional support/resistance.

Correct reading:

- VP nodes are structural references
- their importance depends on context, distance, clustering, and current regime

## 15. What More Principle Information Helps An LLM

For prompt engineering, the most useful principle information is:

- causal order
- priority rules
- interpretation boundaries
- conflict handling
- module role separation

What is less useful:

- UI/display behavior
- rendering-specific transformations
- cosmetic plotting logic
- low-level implementation details that do not affect decision semantics

This is why this document focuses on logical function, not code-by-code implementation.

## 16. Final Reading Model

The webhook should be used with this mental model:

- `regime` says what kind of market this is
- `momentum` and `osc` say what internal directional condition exists
- `context` says whether the environment supports a directional idea
- `trigger` says what fired now
- `signal` says how strong the engine thinks the setup is
- `filter` says whether the setup is actually accepted
- `structure`, `vp`, `divergence`, and `obos` say whether the location is attractive or fragile

That is the intended engine logic behind `bitpunk.webhook.v4`.
