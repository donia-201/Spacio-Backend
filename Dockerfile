# Single-stage: this API has no build step, only `npm ci`.
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first so the layer is cached across code changes.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Drop root. The node image ships an unprivileged `node` user already.
USER node

ENV PORT=3000
EXPOSE 3000

# GET / answers as soon as the app is mounted.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]