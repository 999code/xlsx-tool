import fs from 'node:fs/promises';
import path from 'node:path';

import { HttpError } from './http-error.js';
import { WorkbookStore } from './workbook-store.js';

function isWorkbookFileName(fileName) {
  return typeof fileName === 'string'
    && fileName === path.basename(fileName)
    && !fileName.startsWith('.')
    && !fileName.startsWith('~$')
    && /\.xlsx$/i.test(fileName)
    && !/\.backup\.xlsx$/i.test(fileName);
}

export class WorkbookCatalog {
  constructor({ workbookDirectory, workbookPath, headerRow = 1, createBackup = true }) {
    this.workbookDirectory = path.resolve(workbookDirectory);
    this.defaultWorkbookName = path.dirname(path.resolve(workbookPath)) === this.workbookDirectory
      ? path.basename(workbookPath)
      : null;
    this.storeOptions = { headerRow, createBackup };
    this.stores = new Map();
  }

  async list() {
    let entries;
    try {
      entries = await fs.readdir(this.workbookDirectory, { withFileTypes: true });
    } catch (error) {
      throw new HttpError(500, `无法读取工作簿目录：${this.workbookDirectory}`, error.message);
    }

    const fileNames = entries
      .filter((entry) => entry.isFile() && isWorkbookFileName(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }));

    const workbooks = await Promise.all(fileNames.map(async (fileName) => {
      const stat = await fs.stat(path.join(this.workbookDirectory, fileName));
      return {
        fileName,
        fileSize: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    }));
    const defaultFileName = fileNames.includes(this.defaultWorkbookName)
      ? this.defaultWorkbookName
      : fileNames[0] || null;

    return { workbooks, defaultFileName };
  }

  async getSelection(requestedFileName) {
    const fileName = requestedFileName === undefined ? '' : String(requestedFileName).trim();
    if (fileName && !isWorkbookFileName(fileName)) {
      throw new HttpError(400, '工作簿文件名无效');
    }

    const catalog = await this.list();
    const selectedFileName = fileName || catalog.defaultFileName;
    if (!selectedFileName) throw new HttpError(404, '工作簿目录中没有可用的 .xlsx 文件');
    if (!catalog.workbooks.some((workbook) => workbook.fileName === selectedFileName)) {
      throw new HttpError(404, `工作簿“${selectedFileName}”不存在`);
    }

    const filePath = path.join(this.workbookDirectory, selectedFileName);
    let store = this.stores.get(selectedFileName);
    if (!store) {
      store = new WorkbookStore({ workbookPath: filePath, ...this.storeOptions });
      this.stores.set(selectedFileName, store);
    }

    return { fileName: selectedFileName, filePath, store };
  }
}
