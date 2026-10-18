FROM node:22-alpine
RUN apk add --no-cache docker-cli docker-cli-buildx docker-cli-compose git postgresql16-client && corepack enable \
  && git config --system --add safe.directory /repo
WORKDIR /agent
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/deploy-agent packages/deploy-agent
RUN pnpm install --filter @homegrown/deploy-agent --frozen-lockfile --prod
WORKDIR /agent/packages/deploy-agent
CMD ["pnpm", "-s", "start"]
