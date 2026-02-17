# ---- Stage 1: Builder ----
# We need a full Node image here because better-sqlite3 contains C++ code
# that must be compiled during npm install. That compilation requires
# Python, make, and g++ — tools we don't want in the final image.
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files before source code. Docker caches each step as a layer,
# and a layer is only invalidated when its inputs change. By copying
# package*.json first and running npm ci in a separate step, Docker can
# reuse the installed node_modules layer on subsequent builds as long as
# your dependencies haven't changed — even if your source files have.
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build


# ---- Stage 2: Production image ----
# Start fresh from a lean Alpine image. No build tools, no TypeScript
# compiler, no source files — just what's needed to run the bot.
FROM node:22-alpine

WORKDIR /app

# Copy the compiled JavaScript and node_modules from the builder stage.
# We copy node_modules rather than reinstalling because better-sqlite3's
# compiled native binary was built against the builder's Node version and
# architecture — reinstalling here without build tools would fail.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Create the data directory. At runtime, Docker will mount the host
# directory over this path, but creating it ensures the directory exists
# with the right permissions if the mount ever isn't present.
RUN mkdir -p /app/data

# Don't use `npm start` here — that script uses --env-file=.env which
# assumes a local .env file. In Docker, environment variables are injected
# by the compose file, so we call Node directly.
CMD ["node", "dist/index.js"]
