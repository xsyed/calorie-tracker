FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json

RUN npm ci

COPY tsconfig.json ./
COPY apps/backend/tsconfig.json apps/backend/tsconfig.json
COPY apps/backend/src apps/backend/src

RUN npm run -w @calories/backend build
RUN npm prune --omit=dev

FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node --from=build /app/node_modules node_modules
COPY --chown=node:node --from=build /app/apps/backend/dist apps/backend/dist

USER node

CMD ["node", "apps/backend/dist/server.js"]
