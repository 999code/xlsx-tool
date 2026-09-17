import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { WorkbookStore } from '../src/workbook-store.js';

const sourceWorkbook = path.resolve('..', 'excel', 'test.xlsx');

function sampleValue(column, suffix = '') {
  if (column.type === 'number') return 20260916;
  if (column.type === 'boolean') return true;
  if (column.type === 'date') return '2026-09-16T08:00:00.000Z';
  return `自动化测试${suffix}`;
}

test('reads workbook metadata and completes CRUD without changing the source workbook', async () => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'xlsx-store-'));
  const temporaryWorkbook = path.join(temporaryDirectory, 'test-copy.xlsx');
  await fs.copyFile(sourceWorkbook, temporaryWorkbook);

  const store = new WorkbookStore({
    workbookPath: temporaryWorkbook,
    headerRow: 1,
    createBackup: false,
  });

  const metadata = await store.getMetadata();
  assert.ok(metadata.sheets.length > 0);
  const sheet = metadata.sheets.find((item) => item.columns.length > 0);
  assert.ok(sheet, 'expected at least one sheet with columns');

  const before = await store.listRecords(sheet.name, { pageSize: 100 });
  const payload = Object.fromEntries(sheet.columns.map((column) => [column.key, sampleValue(column)]));
  const created = await store.createRecord(sheet.name, payload);
  assert.ok(created.record._rowNumber > 1);

  const firstColumn = sheet.columns[0];
  const updatedValue = sampleValue(firstColumn, '-已更新');
  const updated = await store.updateRecord(
    sheet.name,
    created.record._rowNumber,
    { [firstColumn.key]: updatedValue },
  );
  assert.equal(updated.record[firstColumn.key], firstColumn.type === 'date'
    ? new Date(updatedValue).toISOString()
    : updatedValue);

  const deleted = await store.deleteRecord(sheet.name, created.record._rowNumber);
  assert.equal(deleted.deleted._rowNumber, created.record._rowNumber);
  const after = await store.listRecords(sheet.name, { pageSize: 100 });
  assert.equal(after.pagination.total, before.pagination.total);
});
