FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json

RUN npm install

COPY . .

WORKDIR /app/server

EXPOSE 2567

CMD ["npm", "run", "start"]
