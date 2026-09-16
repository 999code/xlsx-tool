import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultWorkbookPath = path.resolve(currentDirectory, '../../test.xlsx');

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  port: parsePositiveInteger(process.env.PORT, 3001),
  workbookPath: process.env.WORKBOOK_PATH
    ? path.resolve(process.cwd(), process.env.WORKBOOK_PATH)
    : defaultWorkbookPath,
  headerRow: parsePositiveInteger(process.env.XLSX_HEADER_ROW, 1),
  createBackup: process.env.XLSX_CREATE_BACKUP !== 'false',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
