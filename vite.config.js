import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 로컬 개발(npm run dev)에서도 Vercel 서버리스 함수(/api/pixabay)가 똑같이 동작하도록 해 주는 작은 플러그인
function devApi(env) {
  const names = ['pixabay', 'weather', 'visitors'];
  return {
    name: 'dev-api',
    configureServer(server) {
      for (const name of names) {
        server.middlewares.use(`/api/${name}`, async (req, res) => {
          process.env.PIXABAY_API_KEY = env.PIXABAY_API_KEY || '';
          process.env.DATA_GO_KR_KEY = env.DATA_GO_KR_KEY || '';
          const url = new URL(req.originalUrl || req.url, 'http://localhost');
          req.query = Object.fromEntries(url.searchParams);
          res.status = (code) => { res.statusCode = code; return res; };
          res.json = (obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
          try {
            const { default: handler } = await server.ssrLoadModule(`/api/${name}.js`);
            await handler(req, res);
          } catch (e) {
            res.status(500).json({ error: String(e && e.message || e) });
          }
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [react(), devApi(env)] };
});
