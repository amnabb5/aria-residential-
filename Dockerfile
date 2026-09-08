# Aria Residences — production image (multi-stage-free: build on the host,
# then `docker build .` copies the prepared standalone output).
#
#   npm run build          # produces .next/standalone (app + assets)
#   docker build -t aria-residences .
#   docker run -p 3000:3000 aria-residences
#
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

# The standalone output is self-contained: server.js, minimal node_modules,
# static chunks and all referenced 3D assets.
COPY .next/standalone ./

EXPOSE 3000
CMD ["node", "server.js"]
