FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@10.28.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --no-frozen-lockfile
RUN pnpm -r --filter "./packages/*" build
RUN pnpm --filter @novapos/api build

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/main.js"]
