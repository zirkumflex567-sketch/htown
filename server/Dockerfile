FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared ./shared
COPY server ./server
RUN npm install --workspaces --include-workspace-root
WORKDIR /app/server
RUN npm run build
EXPOSE 2567
CMD ["npm", "run", "start"]
