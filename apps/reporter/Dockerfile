FROM node:current-alpine3.21

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

COPY packages ./packages

COPY apps/reporter ./apps/reporter

RUN npm install -g pnpm && pnpm install

RUN pnpm --filter @repo/prisma generate

RUN pnpm build

COPY .env ./packages/prisma/.env

WORKDIR /app/apps/reporter

CMD ["pnpm", "start:prod"]
