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

function sheetUrl(sheetName) {
  return `/api/sheets/${encodeURIComponent(sheetName)}/records`;
}

export const api = {
  getWorkbook() {
    return request('/api/workbook');
  },

  getRecords(sheetName, { page, pageSize, search }) {
    const params = new URLSearchParams({ page, pageSize });
    if (search) params.set('search', search);
    return request(`${sheetUrl(sheetName)}?${params}`);
  },

  createRecord(sheetName, record) {
    return request(sheetUrl(sheetName), {
      method: 'POST',
      body: JSON.stringify(record),
    });
  },

  updateRecord(sheetName, rowNumber, record) {
    return request(`${sheetUrl(sheetName)}/${rowNumber}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    });
  },

  deleteRecord(sheetName, rowNumber) {
    return request(`${sheetUrl(sheetName)}/${rowNumber}`, { method: 'DELETE' });
  },
};
