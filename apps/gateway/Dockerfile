#node:current-alpine3.21
FROM node@sha256:3eb2e1adfcf3945867eb4d763cfa4cb3a0a2560d70de10481d95453488854786

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

COPY packages ./packages

COPY apps/gateway ./apps/gateway

RUN npm install -g pnpm && pnpm install

RUN pnpm build

WORKDIR /app/apps/gateway

CMD ["pnpm", "start:prod"]
