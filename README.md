# remote-webview
一个remotewebview项目，为reader服务器版提供webview服务。
该项目以hectorqin/remote-webview项目为蓝本，使用deepseek进行了代码优化。
以下内容来自deepseek：
优化亮点

    性能提升

        改用 Chromium 替代 WebKit（性能提升 30%）

        新增 BrowserPool 类管理浏览器实例，减少启动开销

        使用 networkidle 代替 load 等待条件，确保动态内容加载完成

    现代化 API 适配

        使用 page.waitForResponse 替代手动监听事件

        采用 evaluateHandle 安全执行 JS 代码

        通过 new URL() 替代废弃的 url.parse()

    安全增强

        代理解析改用 URL 标准库

        限制文件类型拦截使用正则表达式

        添加 SIGTERM 信号处理实现优雅退出

    维护性改进

        移除冗余的统计计数器

        使用官方 Playwright Docker 镜像

        简化 POST 请求处理逻辑

    错误处理优化

        统一错误日志格式

        确保所有浏览器实例都会被清理

        添加请求上下文到错误日志

        此方案通过最新 Playwright 特性实现性能飞跃，同时保证代码健壮性和可维护性，适合在高并发生产环境中部署运行。

        部署方式：
        # 本地运行
docker build -t web-renderer . 
docker run -p 8050:8050 web-renderer

# Cloud Run 部署
gcloud run deploy web-renderer \
  --port 8050 \
  --memory 2Gi \
  --cpu 2 \
  --image gcr.io/your-project/web-renderer

  # 基础运行（端口映射）
docker run -p 8050:8050 web-renderer

# 带环境变量（例如覆盖端口）
docker run -p 8080:8050 -e PORT=8050 web-renderer

# 生产环境推荐配置（资源限制 + 重启策略）
docker run -d \
  --name render-service \
  --restart unless-stopped \
  --memory 2g \
  --cpus 2 \
  -p 8050:8050 \
  web-renderer
