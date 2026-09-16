import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { config } from './config.js';
import { HttpError } from './http-error.js';
import { WorkbookStore } from './workbook-store.js';

const app = express();
const store = new WorkbookStore(config);

app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin.split(',').map((value) => value.trim()) }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};

function parsePositiveInteger(value, fallback, maximum = Number.POSITIVE_INFINITY) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

app.get('/api/health', asyncRoute(async (_request, response) => {
  const metadata = await store.getMetadata();
  response.json({ success: true, data: { status: 'ok', workbook: metadata.fileName } });
}));

app.get('/api/workbook', asyncRoute(async (_request, response) => {
  response.json({ success: true, data: await store.getMetadata() });
}));

app.get('/api/workbook/download', (_request, response, next) => {
  response.download(config.workbookPath, path.basename(config.workbookPath), next);
});

app.get('/api/sheets/:sheetName/records', asyncRoute(async (request, response) => {
  const page = parsePositiveInteger(request.query.page, 1);
  const pageSize = parsePositiveInteger(request.query.pageSize, 20, 100);
  const data = await store.listRecords(request.params.sheetName, {
    page,
    pageSize,
    search: request.query.search || '',
  });
  response.json({ success: true, data });
}));

app.get('/api/sheets/:sheetName/records/:rowNumber', asyncRoute(async (request, response) => {
  const rowNumber = parsePositiveInteger(request.params.rowNumber, 0);
  response.json({ success: true, data: await store.getRecord(request.params.sheetName, rowNumber) });
}));

app.post('/api/sheets/:sheetName/records', asyncRoute(async (request, response) => {
  const data = await store.createRecord(request.params.sheetName, request.body);
  response.status(201).json({ success: true, data, message: '记录已添加到 Excel' });
}));

app.put('/api/sheets/:sheetName/records/:rowNumber', asyncRoute(async (request, response) => {
  const rowNumber = parsePositiveInteger(request.params.rowNumber, 0);
  const data = await store.updateRecord(request.params.sheetName, rowNumber, request.body, { replace: true });
  response.json({ success: true, data, message: '记录已更新' });
}));

app.patch('/api/sheets/:sheetName/records/:rowNumber', asyncRoute(async (request, response) => {
  const rowNumber = parsePositiveInteger(request.params.rowNumber, 0);
  const data = await store.updateRecord(request.params.sheetName, rowNumber, request.body);
  response.json({ success: true, data, message: '记录已更新' });
}));

app.delete('/api/sheets/:sheetName/records/:rowNumber', asyncRoute(async (request, response) => {
  const rowNumber = parsePositiveInteger(request.params.rowNumber, 0);
  const data = await store.deleteRecord(request.params.sheetName, rowNumber);
  response.json({ success: true, data, message: '记录已删除' });
}));

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(currentDirectory, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('/{*splat}', (_request, response) => response.sendFile(path.join(frontendDist, 'index.html')));
}

app.use((error, _request, response, _next) => {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : '服务器处理请求失败';
  if (status >= 500) console.error(error);
  response.status(status).json({
    success: false,
    error: { message, details: error.details },
  });
});

app.listen(config.port, () => {
  console.log(`XLSX JSON API running at http://localhost:${config.port}`);
  console.log(`Workbook: ${config.workbookPath}`);
});
