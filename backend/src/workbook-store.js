import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';

import { HttpError } from './http-error.js';

const INTERNAL_FIELDS = new Set(['_rowNumber']);

function isBlank(value) {
  return value === null || value === undefined || value === '';
}

function serializeCellValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object') {
    if ('result' in value) return serializeCellValue(value.result);
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? '').join('');
    }
    if ('text' in value) return serializeCellValue(value.text);
    if ('error' in value) return value.error;
  }

  return value;
}

function inferType(values) {
  const types = new Set(
    values
      .filter((value) => !isBlank(value))
      .map((value) => {
        if (typeof value === 'boolean') return 'boolean';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return 'date';
        return 'string';
      }),
  );

  return types.size === 1 ? [...types][0] : 'string';
}

function coerceValue(value, type, label) {
  if (isBlank(value)) return null;

  if (type === 'number') {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      throw new HttpError(400, `字段“${label}”必须是有效数字`);
    }
    return parsed;
  }

  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1 || value === '1') return true;
    if (value === 'false' || value === 0 || value === '0') return false;
    throw new HttpError(400, `字段“${label}”必须是布尔值`);
  }

  if (type === 'date') {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpError(400, `字段“${label}”必须是有效日期`);
    }
    return parsed;
  }

  return String(value).trim();
}

function cloneStyle(style) {
  return style ? structuredClone(style) : {};
}

export class WorkbookStore {
  constructor({ workbookPath, headerRow = 1, createBackup = true }) {
    this.workbookPath = path.resolve(workbookPath);
    this.headerRow = headerRow;
    this.createBackup = createBackup;
    this.queue = Promise.resolve();
  }

  runExclusive(task) {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  async assertWorkbookExists() {
    try {
      await fs.access(this.workbookPath);
    } catch {
      throw new HttpError(500, `找不到工作簿：${this.workbookPath}`);
    }
  }

  async loadWorkbook() {
    await this.assertWorkbookExists();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.workbookPath);
    return workbook;
  }

  getWorksheet(workbook, sheetName) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) throw new HttpError(404, `工作表“${sheetName}”不存在`);
    return worksheet;
  }

  getColumns(worksheet) {
    const header = worksheet.getRow(this.headerRow);
    const lastColumn = Math.max(worksheet.actualColumnCount, header.cellCount);
    const duplicateCounts = new Map();
    const columns = [];

    for (let columnNumber = 1; columnNumber <= lastColumn; columnNumber += 1) {
      const rawLabel = String(serializeCellValue(header.getCell(columnNumber).value) ?? '').trim();
      const label = rawLabel || `第 ${columnNumber} 列`;
      const count = (duplicateCounts.get(label) || 0) + 1;
      duplicateCounts.set(label, count);
      const key = count === 1 ? label : `${label}_${count}`;
      const samples = [];

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= this.headerRow || samples.length >= 50) return;
        const value = serializeCellValue(row.getCell(columnNumber).value);
        if (!isBlank(value)) samples.push(value);
      });

      columns.push({
        key,
        label,
        columnNumber,
        type: inferType(samples),
      });
    }

    return columns;
  }

  isDataRow(row, columns) {
    return columns.some(({ columnNumber }) => !isBlank(serializeCellValue(row.getCell(columnNumber).value)));
  }

  serializeRow(row, columns) {
    return columns.reduce(
      (record, column) => {
        record[column.key] = serializeCellValue(row.getCell(column.columnNumber).value);
        return record;
      },
      { _rowNumber: row.number },
    );
  }

  getDataRows(worksheet, columns) {
    const rows = [];
    for (let rowNumber = this.headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (this.isDataRow(row, columns)) rows.push(row);
    }
    return rows;
  }

  async saveWorkbook(workbook) {
    const directory = path.dirname(this.workbookPath);
    const extension = path.extname(this.workbookPath);
    const temporaryPath = path.join(
      directory,
      `.${path.basename(this.workbookPath, extension)}.${crypto.randomUUID()}.tmp${extension}`,
    );

    try {
      if (this.createBackup) {
        await fs.copyFile(this.workbookPath, `${this.workbookPath}.backup.xlsx`);
      }
      await workbook.xlsx.writeFile(temporaryPath);

      try {
        await fs.rename(temporaryPath, this.workbookPath);
      } catch {
        await fs.copyFile(temporaryPath, this.workbookPath);
        await fs.unlink(temporaryPath);
      }
    } catch (error) {
      await fs.unlink(temporaryPath).catch(() => undefined);
      throw new HttpError(500, '写入 Excel 文件失败，请确认文件未被其他程序锁定', error.message);
    }
  }

  getMetadata() {
    return this.runExclusive(async () => {
      const [workbook, stat] = await Promise.all([this.loadWorkbook(), fs.stat(this.workbookPath)]);
      const sheets = workbook.worksheets.map((worksheet) => {
        const columns = this.getColumns(worksheet);
        return {
          name: worksheet.name,
          rowCount: this.getDataRows(worksheet, columns).length,
          columnCount: columns.length,
          columns,
        };
      });

      return {
        fileName: path.basename(this.workbookPath),
        fileSize: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        sheetCount: sheets.length,
        sheets,
      };
    });
  }

  listRecords(sheetName, { page = 1, pageSize = 20, search = '' } = {}) {
    return this.runExclusive(async () => {
      const workbook = await this.loadWorkbook();
      const worksheet = this.getWorksheet(workbook, sheetName);
      const columns = this.getColumns(worksheet);
      const normalizedSearch = String(search).trim().toLocaleLowerCase('zh-CN');
      const records = this.getDataRows(worksheet, columns)
        .map((row) => this.serializeRow(row, columns))
        .filter((record) => {
          if (!normalizedSearch) return true;
          return columns.some(({ key }) =>
            String(record[key] ?? '').toLocaleLowerCase('zh-CN').includes(normalizedSearch),
          );
        });
      const total = records.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;

      return {
        records: records.slice(start, start + pageSize),
        columns,
        pagination: { page: safePage, pageSize, total, totalPages },
      };
    });
  }

  getRecord(sheetName, rowNumber) {
    return this.runExclusive(async () => {
      const workbook = await this.loadWorkbook();
      const worksheet = this.getWorksheet(workbook, sheetName);
      const columns = this.getColumns(worksheet);
      const row = this.getExistingRow(worksheet, columns, rowNumber);
      return { record: this.serializeRow(row, columns), columns };
    });
  }

  getExistingRow(worksheet, columns, rowNumber) {
    if (!Number.isInteger(rowNumber) || rowNumber <= this.headerRow || rowNumber > worksheet.rowCount) {
      throw new HttpError(404, `第 ${rowNumber} 行记录不存在`);
    }
    const row = worksheet.getRow(rowNumber);
    if (!this.isDataRow(row, columns)) throw new HttpError(404, `第 ${rowNumber} 行记录不存在`);
    return row;
  }

  validatePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new HttpError(400, '请求体必须是 JSON 对象');
    }
    const keys = Object.keys(payload).filter((key) => !INTERNAL_FIELDS.has(key));
    if (keys.length === 0) throw new HttpError(400, '至少需要提供一个字段');
  }

  createRecord(sheetName, payload) {
    return this.runExclusive(async () => {
      this.validatePayload(payload);
      const workbook = await this.loadWorkbook();
      const worksheet = this.getWorksheet(workbook, sheetName);
      const columns = this.getColumns(worksheet);
      const values = columns.map((column) => coerceValue(payload[column.key], column.type, column.label));
      const templateRow = this.getDataRows(worksheet, columns).at(-1);
      const row = worksheet.addRow(values);

      if (templateRow) {
        columns.forEach(({ columnNumber }) => {
          row.getCell(columnNumber).style = cloneStyle(templateRow.getCell(columnNumber).style);
        });
      }

      await this.saveWorkbook(workbook);
      return { record: this.serializeRow(row, columns), columns };
    });
  }

  updateRecord(sheetName, rowNumber, payload, { replace = false } = {}) {
    return this.runExclusive(async () => {
      this.validatePayload(payload);
      const workbook = await this.loadWorkbook();
      const worksheet = this.getWorksheet(workbook, sheetName);
      const columns = this.getColumns(worksheet);
      const row = this.getExistingRow(worksheet, columns, rowNumber);
      const knownKeys = new Set(columns.map(({ key }) => key));
      const unknownKeys = Object.keys(payload).filter(
        (key) => !INTERNAL_FIELDS.has(key) && !knownKeys.has(key),
      );
      if (unknownKeys.length) {
        throw new HttpError(400, `未知字段：${unknownKeys.join('、')}`);
      }

      columns.forEach((column) => {
        if (replace || Object.hasOwn(payload, column.key)) {
          row.getCell(column.columnNumber).value = coerceValue(
            payload[column.key],
            column.type,
            column.label,
          );
        }
      });
      row.commit();
      await this.saveWorkbook(workbook);
      return { record: this.serializeRow(row, columns), columns };
    });
  }

  deleteRecord(sheetName, rowNumber) {
    return this.runExclusive(async () => {
      const workbook = await this.loadWorkbook();
      const worksheet = this.getWorksheet(workbook, sheetName);
      const columns = this.getColumns(worksheet);
      const row = this.getExistingRow(worksheet, columns, rowNumber);
      const deleted = this.serializeRow(row, columns);
      worksheet.spliceRows(rowNumber, 1);
      await this.saveWorkbook(workbook);
      return { deleted };
    });
  }
}
