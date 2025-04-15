const http = require('http');
const { URL } = require('url');
const { chromium } = require('playwright');
const https = require('https');

// 错误处理
const logError = (error, context = '') => {
  console.error(`[${new Date().toISOString()}] ERROR [${context}]:`, error.message, error.stack);
};

process.on('uncaughtException', (err) => logError(err, 'uncaughtException'));
process.on('unhandledRejection', (err) => logError(err, 'unhandledRejection'));

// 浏览器实例池
class BrowserPool {
  static instance;
  browsers = new Set();

  constructor() {
    if (BrowserPool.instance) return BrowserPool.instance;
    BrowserPool.instance = this;
  }

  async launch() {
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox']
    });
    this.browsers.add(browser);
    return browser;
  }

  async cleanup() {
    for (const browser of this.browsers) {
      await browser.close();
    }
    this.browsers.clear();
  }
}

// 渲染服务
const renderHtml = async (params) => {
  const {
    url: targetUrl,
    html,
    headers = {},
    js_source,
    proxy,
    http_method = 'GET',
    body = '',
    sourceRegex
  } = params;

  const browserPool = new BrowserPool();
  const browser = await browserPool.launch();
  
  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: headers,
      userAgent: headers['User-Agent'] || await chromium.userAgent()
    });

    const page = await context.newPage();
    await page.route(/\.(png|jpg|jpeg|mp4|mp3)$/, route => route.abort());

    if (http_method === 'POST') {
      await page.setExtraHTTPHeaders(headers);
      await page.goto(targetUrl, { waitUntil: 'networkidle' });
      await page.evaluate(([bodyStr]) => {
        fetch(window.location.href, {
          method: 'POST',
          body: bodyStr
        });
      }, [body]);
    } else if (html) {
      await page.setContent(html, { waitUntil: 'networkidle' });
    } else {
      await page.goto(targetUrl, { waitUntil: 'networkidle' });
    }

    if (sourceRegex) {
      return await page.waitForResponse(new RegExp(sourceRegex), {
        timeout: 15000
      }).then(res => res.text());
    }

    if (js_source) {
      return await page.evaluateHandle(js_source).then(async (handle) => {
        const result = await handle.jsonValue();
        return typeof result === 'string' ? result : JSON.stringify(result);
      });
    }

    return await page.content();
  } finally {
    await context?.close();
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
      res.end(JSON.stringify({ status: 'healthy' }));
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  } catch (err) {
    logError(err, req.url);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

// 启动服务
const PORT = process.env.PORT || 8050;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 优雅退出
process.on('SIGTERM', async () => {
  await new BrowserPool().cleanup();
  server.close();
});
