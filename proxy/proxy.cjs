const sourcePort = Number(process.argv[2]);
const targetPort = Number(process.argv[3]);

console.log({ sourcePort, targetPort });

const http = require('http');
const httpProxy = require('http-proxy');
const proxy = httpProxy.createProxyServer({});

proxy.on('error', function (err, req, res) {
  console.error('Proxy error:', {
    error: err.message,
    stack: err.stack,
    url: req?.url,
    method: req?.method,
    headers: req?.headers,
    code: err.code,
  });

  if (res.writeHead && !res.headersSent) {
    res.writeHead(502);
  }

  if (res.end) {
    res.end('Bad Gateway');
  }
});

const server = http.createServer(function (req, res) {
  //console.log('proxying', req.url, 'to', `http://localhost:${sourcePort}`);
  proxy.web(req, res, { target: `http://localhost:${sourcePort}` });
});

server.on('upgrade', function (req, socket, head) {
  console.log('WebSocket upgrade request:', {
    url: req.url,
    headers: req.headers,
    timestamp: new Date().toISOString(),
    sourcePort,
    targetPort,
  });

  socket.on('error', (err) => {
    console.error('WebSocket socket error:', {
      error: err.message,
      stack: err.stack,
      code: err.code,
      url: req.url,
    });
  });

  proxy.ws(req, socket, head, {
    target: `ws://localhost:${sourcePort}`,
  });
});

server.listen(targetPort, () => {
  console.log(`Starting proxy server: proxying ${targetPort} → ${sourcePort}`);
});
