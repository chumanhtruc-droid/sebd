FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

COPY . .

EXPOSE 3000 10000

ENV PORT=10000
ENV NODE_ENV=production

CMD ["node", "server.js"]
