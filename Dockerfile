FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_AUTO_ORBIT=1
ARG NEXT_PUBLIC_RTSP_PORT=8554
ARG NEXT_PUBLIC_HLS_PORT=8888
ARG NEXT_PUBLIC_WEBRTC_PORT=8889
ENV NEXT_PUBLIC_AUTO_ORBIT=$NEXT_PUBLIC_AUTO_ORBIT
ENV NEXT_PUBLIC_RTSP_PORT=$NEXT_PUBLIC_RTSP_PORT
ENV NEXT_PUBLIC_HLS_PORT=$NEXT_PUBLIC_HLS_PORT
ENV NEXT_PUBLIC_WEBRTC_PORT=$NEXT_PUBLIC_WEBRTC_PORT
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/dist/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/dist/static ./dist/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
