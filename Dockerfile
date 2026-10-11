# IntentGate hosted playground: the Flight Recorder plus a page where anyone can run the
# poisoned-README attack with and without IntentGate. One container, one port.
#
#   docker build -t intentgate .
#   docker run -p 4747:4747 -e ARMORIQ_API_KEY=... -e ANTHROPIC_API_KEY=... intentgate

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY ui/package.json ui/package-lock.json ./ui/
RUN npm ci --ignore-scripts && npm --prefix ui ci --ignore-scripts
COPY tsconfig.json vitest.config.ts ./
COPY src ./src
COPY ui ./ui
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4747
# Session logs and the demo workspace live here; mount a volume to keep them across deploys.
ENV INTENTGATE_HOME=/data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/ui/dist ./ui/dist
COPY package.json README.md ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4747
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/playground').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/cli.js", "playground"]
