# Voice/WebSocket backend (server/index.ts) for Railway.
# The Next.js frontend deploys separately on Vercel — this image is backend only.
FROM node:20-slim

WORKDIR /app

# Install all deps (incl. devDeps): `npm run server` runs via tsx, a devDependency.
COPY package*.json ./
RUN npm ci

# App source. playwright-core needs no local browser — execution is remote on Browserbase.
COPY . .

# Railway injects PORT; server/index.ts binds it (falls back to 3001).
CMD ["npm", "run", "server"]
