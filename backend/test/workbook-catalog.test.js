import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { WorkbookCatalog } from '../src/workbook-catalog.js';

test('lists switchable workbooks while excluding backup and temporary files', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'xlsx-catalog-'));
  await Promise.all([
    fs.writeFile(path.join(directory, '客户数据.xlsx'), 'first'),
    fs.writeFile(path.join(directory, '库存2.xlsx'), 'second'),
    fs.writeFile(path.join(directory, '库存10.xlsx'), 'tenth'),
    fs.writeFile(path.join(directory, '客户数据.xlsx.backup.xlsx'), 'backup'),
    fs.writeFile(path.join(directory, '~$客户数据.xlsx'), 'temporary'),
    fs.writeFile(path.join(directory, '说明.txt'), 'text'),
  ]);

  const catalog = new WorkbookCatalog({
    workbookDirectory: directory,
    workbookPath: path.join(directory, '库存2.xlsx'),
  });
  const result = await catalog.list();

  assert.deepEqual(
    result.workbooks.map((workbook) => workbook.fileName),
    ['客户数据.xlsx', '库存2.xlsx', '库存10.xlsx'],
  );
  assert.equal(result.defaultFileName, '库存2.xlsx');
  assert.equal((await catalog.getSelection()).fileName, '库存2.xlsx');
  assert.equal((await catalog.getSelection('客户数据.xlsx')).filePath, path.join(directory, '客户数据.xlsx'));
  await assert.rejects(() => catalog.getSelection('../客户数据.xlsx'), /文件名无效/);
  await assert.rejects(() => catalog.getSelection('不存在.xlsx'), /不存在/);
});
