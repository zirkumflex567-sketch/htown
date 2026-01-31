FROM node:18-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json
RUN npm install
COPY shared ./shared
COPY server ./server
RUN npm run build --workspace shared && npm run build --workspace server

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY --from=base /app/server/dist ./server/dist
COPY --from=base /app/server/package.json ./server/package.json
COPY --from=base /app/shared/dist ./shared/dist
COPY --from=base /app/shared/package.json ./shared/package.json
COPY --from=base /app/shared/data ./shared/data
RUN npm install --omit=dev --workspace server --workspace shared
WORKDIR /app/server
EXPOSE 2567
CMD ["node", "dist/index.js"]
