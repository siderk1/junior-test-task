FROM node:current-alpine3.21

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/prisma ./packages/prisma

RUN npm install -g pnpm && pnpm install --filter @repo/prisma...

RUN pnpm --filter @repo/prisma generate

CMD ["pnpm", "--filter", "@repo/prisma", "migrate"]
