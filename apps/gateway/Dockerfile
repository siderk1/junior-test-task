FROM node:current-alpine3.21

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

COPY packages ./packages

COPY apps/gateway ./apps/gateway

RUN npm install -g pnpm && pnpm install

RUN pnpm build

WORKDIR /app/apps/gateway

CMD ["pnpm", "start:prod"]
