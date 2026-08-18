# Use Node 20 on Linux (fixes both the Node version and the native binding issues)
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install dependencies
# Running npm install on Linux ensures the correct oxc-transform binaries are downloaded
COPY package*.json ./
RUN npm install

# Copy the rest of the code and build
COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:20-slim AS runner

WORKDIR /app

# Copy only the necessary files from the builder
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Set production environment
ENV NODE_ENV=production
# Nitro listens to process.env.PORT automatically, which Railway injects
ENV PORT=3000
EXPOSE 3000

# Start the Nitro server
CMD ["node", ".output/server/index.mjs"]
