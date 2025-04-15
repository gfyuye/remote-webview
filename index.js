const http = require('http');
const { URL } = require('url');
const { chromium } = require('playwright');

// 增强错误日志
const logError = (error, context = '') => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR [${context}]`, {
    message: error.message,
    stack: error.stack,
    type: error.constructor.name
  });
};

process.on('uncaughtException', (err) => logError(err, 'uncaughtException'));
process.on('unhandledRejection', (err) => logError(err, 'unhandledRejection'));

// 浏览器连接池
class BrowserPool {
  static MAX_INSTANCES = 5;
  static activeInstances = 0;
  static pool = [];

  static async acquire() {
    if (this.activeInstances >= this.MAX_INSTANCES) {
      throw new Error('Browser pool exhausted');
    }

    const browser = await chromium.launch({
      headless: true,
      timeout: 60000,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-setuid-sandbox'
      ]
    });
    
    this.activeInstances++;
    this.pool.push(browser);
    return browser;
  }

  static async release(browser) {
    try {
      await browser.close();
      this.pool = this.pool.filter(b => b !== browser);
      this.activeInstances--;
    } catch (err) {
      logError(err, 'browser_release');
    }
  }
}

// 渲染核心逻辑
const renderHtml = async (params) => {
  let browser, context;

  try {
    // 参数验证
    if (!params.url && !params.html) {
      throw new Error('Missing required parameter: url or html');
    }

    // 获取浏览器实例
    browser = await BrowserPool.acquire();
    context = await browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent: params.headers?.['User-Agent'] || await chromium.userAgent(),
      proxy: params.proxy ? parseProxy(params.proxy) : undefined
    });

    const page = await context.newPage();
    
    // 资源拦截
    await page.route(/\.(png|jpg|jpeg|mp4|mp3|gif|css|woff2?)$/, route => route.abort());

    // 页面加载
    const loadOptions = {
      waitUntil: 'networkidle',
      timeout: params.timeout || 30000
    };

    if (params.http_method === 'POST') {
      await page.goto(params.url, loadOptions);
      await page.evaluate(([body]) => {
        fetch(window.location.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }, [params.body]);
    } else if (params.html) {
      await page.setContent(params.html, loadOptions);
    } else {
      await page.goto(params.url, loadOptions);
    }

    // 响应拦截
    if (params.sourceRegex) {
      try {
        const regex = new RegExp(params.sourceRegex);
        const response = await page.waitForResponse(regex, { timeout: 15000 });
        return response.text();
      } catch {
        throw new Error(`Invalid regex: ${params.sourceRegex}`);
      }
    }

    // JS执行
    if (params.js_source) {
      const result = await page.evaluate(params.js_source);
      return typeof result === 'string' ? result : JSON.stringify(result);
    }

    return await page.content();

  } finally {
    try {
      if (context) await context.close();
      if (browser) await BrowserPool.release(browser);
    } catch (err) {
      logError(err, 'cleanup_failed');
    }
  }
};

// HTTP服务器
const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    if (pathname === '/render.html') {
      const buffers = [];
      for await (const chunk of req) buffers.push(chunk);
      const params = JSON.parse(Buffer.concat(buffers).toString());

      const result = await renderHtml(params);
      res.end(result);
    } else if (pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'ok',
        browsers: BrowserPool.activeInstances
      }));
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  }
});

// 启动服务
const PORT = process.env.PORT || 8050;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  await Promise.all(BrowserPool.pool.map(b => b.close()));
  server.close();
});
