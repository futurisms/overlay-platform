/**
 * Local CORS Proxy Server
 * Proxies requests from frontend to API Gateway to avoid CORS issues
 */

const https = require('https');
const http = require('http');
const url = require('url');

const API_BASE_URL = 'https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production';
const COGNITO_BASE_URL = 'https://cognito-idp.eu-west-1.amazonaws.com/';
const PORT = 3001;

const server = http.createServer((req, res) => {
  console.log(`\n>>> ${req.method} ${req.url}`);
  if (req.method === 'DELETE') {
    console.log('>>> DELETE REQUEST DETECTED <<<');
    console.log('>>> Headers:', JSON.stringify(req.headers, null, 2));
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Amz-Target');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Determine target URL
  let targetUrl;
  if (req.url.startsWith('/cognito')) {
    // Cognito request
    targetUrl = COGNITO_BASE_URL;
  } else {
    // API Gateway request
    targetUrl = API_BASE_URL + req.url;
  }

  // Collect request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    const parsedUrl = url.parse(targetUrl);

    // Prepare headers
    const headers = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };

    // Forward Authorization header if present
    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'];
    }

    // Forward X-Amz-Target for Cognito
    if (req.headers['x-amz-target']) {
      headers['X-Amz-Target'] = req.headers['x-amz-target'];
    }

    if (body) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    // Make proxy request
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: req.method,
      headers: headers,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      if (req.method === 'DELETE') {
        console.log('>>> DELETE Response Status:', proxyRes.statusCode);
      }

      // Filter out CORS headers from API Gateway to keep proxy's CORS headers
      const filteredHeaders = { ...proxyRes.headers };
      delete filteredHeaders['access-control-allow-origin'];
      delete filteredHeaders['access-control-allow-methods'];
      delete filteredHeaders['access-control-allow-headers'];
      delete filteredHeaders['access-control-allow-credentials'];

      // Forward status code and filtered headers
      res.writeHead(proxyRes.statusCode, filteredHeaders);

      // Forward response body
      proxyRes.pipe(res);
    });

    // Set timeout to 5 minutes (matches Lambda timeout) for long-running operations like annotation generation
    proxyReq.setTimeout(300000, () => {
      console.error('Request timeout after 300 seconds');
      if (!res.headersSent) {
        res.writeHead(504);
        res.end(JSON.stringify({ error: 'Gateway timeout - request took longer than 5 minutes' }));
      }
      proxyReq.abort();
    });

    proxyReq.on('error', (error) => {
      console.error('Proxy error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    });

    if (body) {
      proxyReq.write(body);
    }

    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`\n🔄 CORS Proxy Server running on http://localhost:${PORT}`);
  console.log(`   Proxying API Gateway: ${API_BASE_URL}`);
  console.log(`   Proxying Cognito: ${COGNITO_BASE_URL}`);
  console.log(`   Allowing origin: http://localhost:3000\n`);
});
