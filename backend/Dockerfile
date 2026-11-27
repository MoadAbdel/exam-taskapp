# API Express - image de production (multi-etapes, utilisateur non root).
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Dependances de production seulement, sans scripts d'installation.
RUN npm ci --omit=dev --ignore-scripts

FROM node:26-alpine
ENV NODE_ENV=production LOG_TO_FILE=true PORT=5000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .
RUN mkdir -p logs && chown node:node logs
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1
CMD ["node", "server.js"]
