FROM node:24-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/hermes/package.json apps/hermes/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN pnpm install --frozen-lockfile

COPY apps/hermes apps/hermes
COPY packages/db packages/db
COPY packages/domain packages/domain
COPY packages/contracts packages/contracts

CMD ["pnpm", "--filter", "@big-banana/hermes", "start"]
