# Optional: deploy as Docker on Render (set service runtime to Docker and use this file).
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
