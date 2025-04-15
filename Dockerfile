# 使用官方 Playwright 镜像
FROM mcr.microsoft.com/playwright:v1.42.0-jammy

# 设置工作目录
WORKDIR /app

# 安装生产依赖
COPY package*.json ./
RUN npm install --production

# 复制项目文件
COPY . .

# 设置非 root 用户
RUN chown -R playwright:playwright /app
USER playwright

# 暴露端口
EXPOSE 8050

# 启动命令
CMD ["npm", "start"]
