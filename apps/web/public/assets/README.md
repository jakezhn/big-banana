# Frontend Assets

这个目录用于 `apps/web` 前端直接消费的静态素材。

## 目录约定

- `brand/`
  - logo
  - monogram
  - favicon source
  - 未来如果有导出的 SVG/PNG 品牌资产，也优先放这里
- `marketing/`
  - 需要直接进入页面的品牌视觉、宣传图、截图
- `illustrations/`
  - 插画、信息图、空态图
- `motion/`
  - 动效相关素材、序列帧、可直接静态托管的 motion 资源

## 当前规则

- 前端优先使用 SVG 品牌资产
- 同一资源尽量保留语义清晰的命名
- 不要把后端文档里的设计参考图直接当成线上页面资产使用
- 页面真正使用的资源，应复制或导出到 `apps/web/public/assets/**`

## 命名建议

```txt
brand/bitpunk-logo.svg
brand/bitpunk-monogram.svg
brand/bitpunk-favicon.svg
marketing/hero-cockpit-v1.png
illustrations/empty-agent-runs.svg
motion/grid-pulse-loop.webm
```
