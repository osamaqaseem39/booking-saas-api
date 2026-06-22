FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY public ./public

ENV OPENWA_GATEWAY_PORT=2785 \
    OPENWA_DASHBOARD_PORT=2886 \
    OPENWA_MODE=mock \
    OPENWA_DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 2785 2886

CMD ["npm", "start"]
