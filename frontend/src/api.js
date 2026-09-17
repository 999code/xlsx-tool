async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message || `请求失败（${response.status}）`);
  }
  return payload;
}

function withWorkbook(url, workbookName, params = new URLSearchParams()) {
  if (workbookName) params.set('workbook', workbookName);
  const query = params.toString();
  return query ? `${url}?${query}` : url;
}

function sheetUrl(sheetName, workbookName, params) {
  return withWorkbook(`/api/sheets/${encodeURIComponent(sheetName)}/records`, workbookName, params);
}

export const api = {
  getWorkbooks() {
    return request('/api/workbooks');
  },

  getWorkbook(workbookName) {
    return request(withWorkbook('/api/workbook', workbookName));
  },

  getWorkbookDownloadUrl(workbookName) {
    return withWorkbook('/api/workbook/download', workbookName);
  },

  getRecords(workbookName, sheetName, { page, pageSize, search }) {
    const params = new URLSearchParams({ page, pageSize });
    if (search) params.set('search', search);
    return request(sheetUrl(sheetName, workbookName, params));
  },

  createRecord(workbookName, sheetName, record) {
    return request(sheetUrl(sheetName, workbookName), {
      method: 'POST',
      body: JSON.stringify(record),
    });
  },

  updateRecord(workbookName, sheetName, rowNumber, record) {
    return request(withWorkbook(`${sheetUrl(sheetName)}/${rowNumber}`, workbookName), {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  },

  deleteRecord(workbookName, sheetName, rowNumber) {
    return request(withWorkbook(`${sheetUrl(sheetName)}/${rowNumber}`, workbookName), { method: 'DELETE' });
  },
};
