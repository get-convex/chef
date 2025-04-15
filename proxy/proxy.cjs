const sourcePort = Number(process.argv[2]);
const targetPort = Number(process.argv[3]);

const http = require('http');
const httpProxy = require('http-proxy');
const proxy = httpProxy.createProxyServer({});

proxy.on('error', function (err, req, res) {
  console.error('Proxy error:', err);
  if (res.writeHead && !res.headersSent) {
    res.writeHead(502);
  }

  if (res.end) {
    res.end('Bad Gateway');
  }
});

const server = http.createServer(function (req, res) {
  proxy.web(req, res, { target: `http://localhost:${sourcePort}` });
});

server.on('upgrade', function (req, socket, head) {
  proxy.ws(req, socket, head, { target: `ws://localhost:${sourcePort}` });
});

server.listen(targetPort, () => {
  console.log(`Starting proxy server: proxying ${targetPort} → ${sourcePort}`);
});
