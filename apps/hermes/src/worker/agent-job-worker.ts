import type {
  AgentJobRepository,
  AgentJobType,
  StoredAgentJob
} from "@big-banana/domain";
import type { HermesWorkerConfig } from "../config/get-hermes-worker-config-from-env";
import type { AgentJobHandler, AgentJobHandlerContext } from "./agent-job-handler";

export type AgentJobWorkerDependencies = {
  jobRepository: AgentJobRepository;
  config: HermesWorkerConfig;
  handlers: Partial<Record<AgentJobType, AgentJobHandler>>;
  logger?: Pick<Console, "info" | "warn" | "error">;
  now?: () => string;
};

export type AgentJobWorkerRunResult =
  | { kind: "idle"; requeuedTimedOutJobs: number }
  | {
      kind: "completed";
      jobId: string;
      jobType: AgentJobType;
      requeuedTimedOutJobs: number;
    }
  | {
      kind: "failed";
      jobId: string;
      jobType: AgentJobType;
      requeuedTimedOutJobs: number;
      errorMessage: string;
    };

export class AgentJobWorker {
  private readonly logger: Pick<Console, "info" | "warn" | "error">;
  private readonly now: () => string;

  constructor(private readonly deps: AgentJobWorkerDependencies) {
    this.logger = deps.logger ?? console;
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  async runOnce(): Promise<AgentJobWorkerRunResult> {
    const now = this.now();
    const requeuedTimedOutJobs =
      await this.deps.jobRepository.requeueTimedOutJobs(now);

    if (requeuedTimedOutJobs > 0) {
      this.logger.warn(
        `[hermes] requeued ${requeuedTimedOutJobs} timed out agent job(s)`
      );
    }

    const job = await this.deps.jobRepository.claimNextJob({
      workerId: this.deps.config.workerId,
      lockTtlSeconds: this.deps.config.lockTtlSeconds,
      now,
      jobTypes: this.deps.config.jobTypes,
      markets: this.deps.config.markets
    });

    if (!job) {
      return { kind: "idle", requeuedTimedOutJobs };
    }

    return this.processClaimedJob(job, requeuedTimedOutJobs);
  }

  async runUntilStopped(signal: AbortSignal): Promise<void> {
    this.logger.info(
      `[hermes] worker ${this.deps.config.workerId} started for jobTypes=${this.deps.config.jobTypes.join(",")}`
    );

    while (!signal.aborted) {
      const result = await this.runOnce();

      if (signal.aborted) {
        break;
      }

      if (result.kind === "idle") {
        await waitFor(this.deps.config.pollIntervalMs, signal);
      }
    }

    this.logger.info(`[hermes] worker ${this.deps.config.workerId} stopped`);
  }

  private async processClaimedJob(
    job: StoredAgentJob,
    requeuedTimedOutJobs: number
  ): Promise<AgentJobWorkerRunResult> {
    const handler = this.deps.handlers[job.jobType];

    if (!handler) {
      const failedAt = this.now();
      const errorMessage = `No Hermes handler registered for job type ${job.jobType}`;
      await this.deps.jobRepository.reportJobFailure(
        job.id,
        this.deps.config.workerId,
        failedAt,
        errorMessage
      );

      return {
        kind: "failed",
        jobId: job.id,
        jobType: job.jobType,
        requeuedTimedOutJobs,
        errorMessage
      };
    }

    const context: AgentJobHandlerContext = {
      now: this.now,
      logger: this.logger
    };

    try {
      const resultRefJson = await handler(job, context);
      const completedAt = this.now();
      await this.deps.jobRepository.markJobCompleted(
        job.id,
        this.deps.config.workerId,
        completedAt,
        resultRefJson
      );

      this.logger.info(
        `[hermes] completed job ${job.id} (${job.jobType})`
      );

      return {
        kind: "completed",
        jobId: job.id,
        jobType: job.jobType,
        requeuedTimedOutJobs
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown Hermes worker error";
      const failedAt = this.now();

      await this.deps.jobRepository.reportJobFailure(
        job.id,
        this.deps.config.workerId,
        failedAt,
        errorMessage
      );

      this.logger.error(
        `[hermes] failed job ${job.id} (${job.jobType}): ${errorMessage}`
      );

      return {
        kind: "failed",
        jobId: job.id,
        jobType: job.jobType,
        requeuedTimedOutJobs,
        errorMessage
      };
    }
  }
}

async function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };

    signal.addEventListener("abort", onAbort);
  });
}
