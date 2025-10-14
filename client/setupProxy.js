const { createProxyMiddleware } = require('http-proxy-middleware');

console.log('🔧 Loading setupProxy.js...');

module.exports = function(app) {
  console.log('🚀 Setting up proxy middleware...');
  
  // Only proxy API requests to the backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onError: function (err, req, res) {
        console.error('❌ Proxy error:', err.message);
        console.error('Request URL:', req.url);
        console.error('Request method:', req.method);
      },
      onProxyReq: function (proxyReq, req, res) {
        console.log('🔄 Proxying request:', req.method, req.url, '→ http://localhost:5000' + req.url);
      },
      onProxyRes: function (proxyRes, req, res) {
        console.log('✅ Proxy response:', proxyRes.statusCode, req.url);
      }
    })
  );

  // Proxy Socket.IO requests
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying
      secure: false,
      logLevel: 'debug',
      onError: function (err, req, res) {
        console.error('❌ Socket.IO proxy error:', err.message);
      }
    })
  );

  console.log('✅ Proxy middleware configured successfully');
  console.log('📡 API requests (/api/*) will be proxied to http://localhost:5000');
  console.log('🔌 Socket.IO requests (/socket.io/*) will be proxied to http://localhost:5000');
};


