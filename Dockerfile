FROM node:24-slim

# Prisma's query engine needs libssl; node:slim doesn't ship it, and without
# it Prisma silently guesses the OpenSSL version instead of detecting it.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so this layer is cached across source-only changes.
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

COPY . .

# `next build` statically prerenders the home page, which queries the
# database, so a schema needs to exist before building. This pushes it to a
# throwaway build-time database rather than /app/data: /app/data must stay
# absent from the image so that when docker-compose mounts a fresh named
# volume there, it starts genuinely empty instead of being pre-populated
# from image content (Docker's default behavior for a new named volume
# mounted over an existing directory).
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma db push --accept-data-loss
RUN npm run build

# Real runtime database — persisted via the docker-compose volume at /app/data.
ENV DATABASE_URL="file:/app/data/dev.db"

EXPOSE 3000

RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
