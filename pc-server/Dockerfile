FROM node:20-alpine AS builder
WORKDIR /app

# better-sqlite3 needs native build tools
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 8787
CMD ["node", "dist/index.js"]
