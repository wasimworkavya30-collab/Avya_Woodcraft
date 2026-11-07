FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_FILE=/data/avya.db

# Install with the committed lockfile so builds stay reproducible.
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci

COPY . .
RUN npm run build

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 4000
CMD ["npm", "start"]
