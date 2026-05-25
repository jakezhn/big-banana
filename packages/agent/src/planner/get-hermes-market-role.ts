import type { AgentJobMarket } from "@big-banana/domain";

export type HermesMarketRoleId =
  | "generic"
  | "crypto"
  | "us_equity"
  | "cn_equity"
  | "commodity"
  | "global_market";

export type HermesMarketRole = {
  roleId: HermesMarketRoleId;
  skillName: string;
  promptVersionSuffix: string | null;
  systemPromptAppendix: string[];
};

export function getHermesMarketRole(
  market: AgentJobMarket | null | undefined
): HermesMarketRole {
  switch (market) {
    case "crypto":
      return {
        roleId: "crypto",
        skillName: "generate_trade_plan.crypto",
        promptVersionSuffix: "crypto",
        systemPromptAppendix: [
          "Operate as Crypto Hermes.",
          "Assume a 24/7 crypto market with fast beta rotation and strong lead-lag effects from BTC and ETH.",
          "Do not rely on equity-session assumptions or earnings-style catalysts."
        ]
      };
    case "us_equity":
      return {
        roleId: "us_equity",
        skillName: "generate_trade_plan.us_equity",
        promptVersionSuffix: "us_equity",
        systemPromptAppendix: [
          "Operate as US Equity Hermes.",
          "Respect cash-session structure, earnings and news/event risk, and sector/index context.",
          "Do not rely on crypto-style 24/7 momentum assumptions."
        ]
      };
    case "cn_equity":
      return {
        roleId: "cn_equity",
        skillName: "generate_trade_plan.cn_equity",
        promptVersionSuffix: "cn_equity",
        systemPromptAppendix: [
          "Operate as CN Equity Hermes.",
          "Respect China/HK market structure, board rotation, liquidity constraints, and policy-driven regime shifts.",
          "Do not rely on US cash-session or crypto-style assumptions."
        ]
      };
    case "commodity":
      return {
        roleId: "commodity",
        skillName: "generate_trade_plan.commodity",
        promptVersionSuffix: "commodity",
        systemPromptAppendix: [
          "Operate as Commodity Hermes.",
          "Respect macro-driver sensitivity such as dollar strength, real yields, inventory, supply-demand, and event shocks.",
          "Do not rely on equity earnings logic or crypto beta-rotation assumptions."
        ]
      };
    default:
      return {
        roleId: "generic",
        skillName: "generate_trade_plan",
        promptVersionSuffix: null,
        systemPromptAppendix: []
      };
  }
}
