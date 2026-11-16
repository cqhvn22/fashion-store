import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

function devMockSyncPlugin() {
  const syncDir = path.resolve(__dirname, '.dev-cache');
  return {
    name: 'dev-mock-sync',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const match = req.url?.match(/^\/api\/dev-mock\/([a-zA-Z0-9_-]+)/);
        if (!match) return next();
        const key = match[1];
        if (!fs.existsSync(syncDir)) {
          try {
            fs.mkdirSync(syncDir, { recursive: true });
          } catch {}
        }
        const filePath = path.resolve(syncDir, `${key}.json`);

        if (req.method === 'GET') {
          try {
            if (fs.existsSync(filePath)) {
              const data = fs.readFileSync(filePath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
              return;
            }
          } catch {}
          res.setHeader('Content-Type', 'application/json');
          res.end('null');
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              if (key === 'fashionhub_orders') {
                const incoming = JSON.parse(body);
                if (!Array.isArray(incoming)) throw new Error('Invalid orders');
                const saved = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : [];
                const merged = new Map<string, any>();
                for (const order of [...(Array.isArray(saved) ? saved : []), ...incoming]) {
                  if (!order?.id) continue;
                  const current = merged.get(order.id);
                  const nextTime = new Date(order.updatedAt || order.createdAt).getTime();
                  const currentTime = current ? new Date(current.updatedAt || current.createdAt).getTime() : -Infinity;
                  if (!current || nextTime > currentTime ||
                      (nextTime === currentTime && (order.history?.length ?? 0) > (current.history?.length ?? 0)))
                    merged.set(order.id, order);
                }
                fs.writeFileSync(filePath, JSON.stringify([...merged.values()]), 'utf-8');
              } else {
                fs.writeFileSync(filePath, body, 'utf-8');
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err?.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

function productImageCachePlugin() {
  const imageRoot = path.resolve(__dirname, 'public/images/products');
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  };
  return {
    name: 'product-image-cache',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        let pathname: string;
        try {
          pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
        } catch {
          return next();
        }
        const prefix = '/images/products/';
        if (!pathname.startsWith(prefix)) return next();

        const filePath = path.resolve(imageRoot, pathname.slice(prefix.length));
        const mimeType = mimeTypes[path.extname(filePath).toLowerCase()];
        if (!filePath.startsWith(imageRoot + path.sep) || !mimeType) {
          res.statusCode = 404;
          res.end();
          return;
        }
        fs.stat(filePath, (error, stats) => {
          if (error || !stats.isFile()) {
            res.statusCode = 404;
            res.end();
            return;
          }
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Length', stats.size);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          if (req.method === 'HEAD') res.end();
          else fs.createReadStream(filePath).pipe(res);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devMockSyncPlugin(), productImageCachePlugin()],
  test: { environment: 'jsdom', setupFiles: './src/tests/setup.ts', testTimeout: 10000 },
});
