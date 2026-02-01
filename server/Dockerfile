FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

WORKDIR /app/server

EXPOSE 2567

CMD ["pnpm", "run", "start"]
