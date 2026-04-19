# -------- Stage 1: Build SPA --------
FROM node:20-alpine AS build
WORKDIR /app

# 依赖层缓存
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 构建
COPY . .
RUN npm run build

# -------- Stage 2: nginx Serve + Reverse Proxy --------
FROM nginx:1.27-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# HTTPS 预留：启用时打开 compose 443 端口映射并编辑 nginx.conf
EXPOSE 443

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
