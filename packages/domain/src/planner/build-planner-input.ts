import type { SignalWebhookPayloadV12 } from "@big-banana/contracts";
import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";
import type { MarketStateRepository } from "../market-state/market-state-repository";

export type PlannerInput = {
  signal: {
    direction: SignalWebhookPayloadV12["signal"]["direction"];
    rankLevel: SignalWebhookPayloadV12["signal"]["rank_level"];
    rankPct: SignalWebhookPayloadV12["signal"]["rank_pct"];
    gain: SignalWebhookPayloadV12["signal"]["gain"];
    pain: SignalWebhookPayloadV12["signal"]["pain"];
    proposedSize: SignalWebhookPayloadV12["signal"]["proposed_size"];
    regime: SignalWebhookPayloadV12["signal"]["regime"];
    regimeAlignment: SignalWebhookPayloadV12["signal"]["regime_alignement"];
    kl: {
      hasKl: SignalWebhookPayloadV12["signal"]["kl"]["has_kl"];
      role: SignalWebhookPayloadV12["signal"]["kl"]["role"];
      source: SignalWebhookPayloadV12["signal"]["kl"]["source"];
    };
    divergence: {
      hasDivergence: SignalWebhookPayloadV12["signal"]["divergence"]["has_divergence"];
    };
  };
  context: CanonicalEnvelope["context"];
  state: {
    latestSnapshots: Record<string, CanonicalEnvelope["context"]>;
    activePlan?: undefined;
    openOrders: [];
    openPosition?: undefined;
  };
};

export class SignalPlannerInputError extends Error {
  constructor() {
    super("Planner input can only be built from signal payloads");
    this.name = "SignalPlannerInputError";
  }
}

export async function buildPlannerInput(
  envelope: CanonicalEnvelope,
  marketStateRepository: MarketStateRepository
): Promise<PlannerInput> {
  if (envelope.type !== "signal" || !envelope.signal) {
    throw new SignalPlannerInputError();
  }

  const latestStates = await marketStateRepository.getLatestStatesByTickerid(
    envelope.context.market.tickerid
  );

  return {
    signal: {
      direction: envelope.signal.direction,
      rankLevel: envelope.signal.rank_level,
      rankPct: envelope.signal.rank_pct,
      gain: envelope.signal.gain,
      pain: envelope.signal.pain,
      proposedSize: envelope.signal.proposed_size,
      regime: envelope.signal.regime,
      regimeAlignment: envelope.signal.regime_alignement,
      kl: {
        hasKl: envelope.signal.kl.has_kl,
        role: envelope.signal.kl.role,
        source: envelope.signal.kl.source
      },
      divergence: {
        hasDivergence: envelope.signal.divergence.has_divergence
      }
    },
    context: envelope.context,
    state: {
      latestSnapshots: Object.fromEntries(
        latestStates.map((state) => [state.marketKey, state.context])
      ),
      activePlan: undefined,
      openOrders: [],
      openPosition: undefined
    }
  };
}
