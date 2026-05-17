import type {
  ReceivedWebhookEvent,
  StoredWebhookEvent,
  WebhookEventRepository
} from "@big-banana/domain";
import postgres, { type Sql } from "postgres";

type WebhookEventRow = {
  id: string;
  source: "tradingview";
  schema_version: "bitpunk.webhook.v12";
  delivery_key: string;
  payload_hash: string;
  event_key: string;
  tickerid: string;
  timeframe: string;
  bar_time_ms: string | number;
  event_type: "snapshot" | "signal";
  raw_payload: ReceivedWebhookEvent["rawPayload"];
  received_at: string;
  last_received_at: string;
  delivery_count: number;
  process_status: string;
};

export class PostgresWebhookEventRepository implements WebhookEventRepository {
  constructor(private readonly sql: Sql) {}

  async recordReceivedEvent(
    event: ReceivedWebhookEvent
  ): Promise<StoredWebhookEvent> {
    const [row] = await this.sql<WebhookEventRow[]>`
      insert into webhook_events (
        source,
        schema_version,
        delivery_key,
        payload_hash,
        event_key,
        tickerid,
        timeframe,
        bar_time_ms,
        event_type,
        raw_payload,
        received_at,
        last_received_at
      ) values (
        ${event.source},
        ${event.schemaVersion},
        ${event.deliveryKey},
        ${event.payloadHash},
        ${event.eventKey},
        ${event.tickerid},
        ${event.timeframe},
        ${event.barTimeMs},
        ${event.eventType},
        ${this.sql.json(event.rawPayload)},
        ${event.receivedAt},
        ${event.receivedAt}
      )
      on conflict (delivery_key)
      do update set
        last_received_at = excluded.last_received_at,
        delivery_count = webhook_events.delivery_count + 1
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist webhook event");
    }

    return {
      id: row.id,
      source: row.source,
      schemaVersion: row.schema_version,
      deliveryKey: row.delivery_key,
      payloadHash: row.payload_hash,
      eventKey: row.event_key,
      tickerid: row.tickerid,
      timeframe: row.timeframe,
      barTimeMs: Number(row.bar_time_ms),
      eventType: row.event_type,
      rawPayload: row.raw_payload,
      receivedAt: row.received_at,
      lastReceivedAt: row.last_received_at,
      deliveryCount: row.delivery_count,
      duplicate: row.delivery_count > 1,
      processStatus: row.process_status
    };
  }

  async updateProcessStatus(
    webhookEventId: string,
    processStatus: string
  ): Promise<void> {
    await this.sql`
      update webhook_events
      set process_status = ${processStatus}
      where id = ${webhookEventId}
    `;
  }
}

export function createWebhookEventRepositoryFromEnv(): PostgresWebhookEventRepository {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return new PostgresWebhookEventRepository(postgres(databaseUrl));
}
