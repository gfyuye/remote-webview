# 使用官方 Playwright 镜像
FROM mcr.microsoft.com/playwright:v1.42.0-jammy

# 设置工作目录
WORKDIR /app

# 安装生产依赖
COPY package*.json ./
RUN npm install --production

# 创建非 root 用户并赋予权限（关键修复）
RUN useradd -m -u 1001 playwright && \
    chown -R playwright:playwright /app

# 复制项目文件（在用户切换前完成）
COPY --chown=playwright:playwright . .

# 切换用户
USER playwright

# 暴露端口
EXPOSE 8050

# 启动命令
CMD ["npm", "start"]
