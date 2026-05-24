import type { JsonValue } from "../orders/order-repository";

export const agentLockScopes = [
  "symbol",
  "plan",
  "risk",
  "execution"
] as const;

export type AgentLockScope = (typeof agentLockScopes)[number];

export type ReceivedAgentLock = {
  lockKey: string;
  scope: AgentLockScope;
  ownerId: string;
  payloadJson: JsonValue;
  lockedAt: string;
  lockedUntil: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredAgentLock = ReceivedAgentLock;

export interface AgentLockRepository {
  getLock(lockKey: string): Promise<StoredAgentLock | null>;

  acquireLock(
    lockKey: string,
    scope: AgentLockScope,
    ownerId: string,
    lockedAt: string,
    lockedUntil: string,
    payloadJson?: JsonValue
  ): Promise<StoredAgentLock | null>;

  renewLock(
    lockKey: string,
    ownerId: string,
    updatedAt: string,
    lockedUntil: string
  ): Promise<StoredAgentLock | null>;

  releaseLock(lockKey: string, ownerId: string): Promise<boolean>;
}
