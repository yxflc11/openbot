FROM node:22.22.0-alpine

WORKDIR /workspace
COPY . .
RUN npm ci && npm run build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
