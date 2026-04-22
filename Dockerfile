# -------- Stage 1: Build SPA --------
ARG FRONTEND_BUILD_IMAGE=node:20-alpine
ARG FRONTEND_RUNTIME_IMAGE=nginx:1.27-alpine
FROM ${FRONTEND_BUILD_IMAGE} AS build
WORKDIR /app

ENV CI=true
ENV NODE_OPTIONS=--max-old-space-size=2048

# Install dependencies first for better layer reuse.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy app source and build in two steps so failures are easier to locate.
COPY . .
RUN npx vue-tsc -b
RUN npx vite build

# -------- Stage 2: nginx Serve + Reverse Proxy --------
FROM ${FRONTEND_RUNTIME_IMAGE}
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# Reserved for optional HTTPS exposure.
EXPOSE 443

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/nginx-health >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
