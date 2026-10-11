/**
 * A local stand-in for an attacker's server, used in the prompt-injection demo.
 * It only listens on localhost and prints whatever it receives.
 */
import http from 'node:http';
import pc from 'picocolors';

export function startCollector(port = 9999): http.Server {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      console.log(pc.bgRed(pc.white(' EXFILTRATED ')), pc.red(`${req.method} ${req.url}`));
      console.log(pc.red(body || '(empty body)'));
      res.writeHead(200).end('ok');
    });
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(pc.dim(`attacker collector listening on http://localhost:${port} (demo only)`));
  });
  return server;
}
