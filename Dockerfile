FROM mcr.microsoft.com/playwright:v1.51.1-jammy

WORKDIR /app

# 安装依赖时使用 root 用户
USER root

COPY package*.json ./
RUN npm install --production

# 创建非 root 用户并赋予必要权限
RUN useradd -m -u 1001 playwright && \
    mkdir -p /home/playwright/.cache/ms-playwright && \
    chown -R playwright:playwright /app /home/playwright

# 复制文件并设置权限
COPY --chown=playwright:playwright . .

USER playwright

EXPOSE 8050
CMD ["npm", "start"]
