# Use Node 20+ as specified in package.json
FROM node:20-alpine

# Install pnpm natively
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy package configurations
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application source code and scripts
COPY . .

# Note: The data directory requires the GeoLite2 MMDB files and JSON threat feeds.
# These can be baked into the image by running `pnpm run refresh-data` during a CI pipeline,
# OR they can be hydrated at runtime or mounted via a persistent volume.
# RUN MAXMIND_LICENSE_KEY="your_key" pnpm run refresh-data

# Expose the API port
EXPOSE 3100
ENV PORT=3100
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Start the API server with memory limits optimized for 2GB RAM
# We give Node 1024MB, Redis 512MB, leaving ~500MB for OS/Buffers
CMD ["node", "--max-old-space-size=1024", "src/server.js"]
