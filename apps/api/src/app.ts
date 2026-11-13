import express from 'express';
import helmet from 'helmet';
export function createApp(databaseReady: () => boolean) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, data: { service: 'GarmentFlow API', status: 'ok' } });
  });
  app.get('/api/v1/ready', (_req, res) => {
    const ready = databaseReady();
    res.status(ready ? 200 : 503).json({ success: ready, data: { database: ready ? 'connected' : 'unavailable' } });
  });
  app.use((_req, res) => { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }); });
  const handler: express.ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const tooLarge = typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large';
    if (tooLarge) { res.status(413).json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 32 KB' } }); return; }
    const malformed = error instanceof SyntaxError;
    res.status(malformed ? 400 : 500).json({ success: false, error: { code: malformed ? 'INVALID_JSON' : 'INTERNAL_ERROR', message: malformed ? 'Invalid JSON body' : 'An unexpected error occurred' } });
  };
  app.use(handler);
  return app;
}
