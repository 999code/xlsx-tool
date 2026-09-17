<template>
  <section class="xlsx-page" aria-labelledby="xlsx-page-title">
    <header class="xlsx-header">
      <div>
        <h1 id="xlsx-page-title">XLSX 数据管理</h1>
        <p class="xlsx-description">
          将 Excel 工作表作为轻量数据源，通过 Node.js API 完成查询、新增、修改与删除。
        </p>
      </div>
     
    </header>

    <el-alert
      v-if="errorMessage"
      class="xlsx-alert"
      type="error"
      :title="errorMessage"
      show-icon
      closable
      @close="errorMessage = ''"
    />

    <section
      class="xlsx-workbook-switcher"
      aria-labelledby="xlsx-workbook-switcher-title"
      v-loading="loadingWorkbooks"
    >
      <div class="xlsx-workbook-switcher__heading">
        <h2 id="xlsx-workbook-switcher-title">Excel 文件</h2>
        <p>{{ workbooks.length }} 个可用工作簿</p>
      </div>
      <el-tabs
        v-if="workbooks.length"
        v-model="activeWorkbook"
        class="xlsx-workbook-tabs"
        @tab-change="handleWorkbookChange"
      >
        <el-tab-pane
          v-for="workbook in workbooks"
          :key="workbook.fileName"
          :name="workbook.fileName"
        >
          <template #label>
            <span class="xlsx-workbook-tab" :title="workbook.fileName">{{ workbook.fileName }}</span>
          </template>
        </el-tab-pane>
      </el-tabs>
      <el-empty v-else :image-size="56" description="目录中没有可用的 .xlsx 文件" />
    </section>

    <div class="xlsx-metrics" aria-label="工作簿概况">
      <div class="xlsx-metric"><span>当前文件</span><strong>{{ metadata?.fileName || '正在读取…' }}</strong></div>
      <div class="xlsx-metric"><span>工作表</span><strong>{{ metadata?.sheetCount ?? '—' }}</strong></div>
      <div class="xlsx-metric"><span>当前记录</span><strong>{{ pagination.total }}</strong></div>
      <div class="xlsx-metric"><span>字段数</span><strong>{{ columns.length }}</strong></div>
    </div>

    <section class="xlsx-panel xlsx-filter" aria-label="数据筛选">
      <SearchForm
        class="xlsx-filter__form"
        :schema="searchSchema"
        :loading="loadingRecords"
        :collapsed-count="2"
        @search="applySearch"
        @reset="resetSearch"
      />
     
    </section>

    <section class="xlsx-panel xlsx-table-panel" aria-label="XLSX 数据列表">
      <div class="xlsx-table-heading">
        <div>
          <h2>{{ activeSheet || '请选择工作表' }}</h2>
          <p>第 {{ pagination.page }} / {{ pagination.totalPages }} 页，共 {{ pagination.total }} 条</p>
        </div>
        <span v-if="metadata?.modifiedAt" class="xlsx-updated">文件更新于 {{ formatDate(metadata.modifiedAt) }}</span>
      </div>

      <div class="table-header">
        <div class="table-header__left">
          <el-button type="primary" :disabled="!activeSheet" @click="openCreate">新增记录</el-button>
          <el-button tag="a" :href="downloadUrl" :disabled="!activeWorkbook">下载 XLSX</el-button>
          <el-button @click="jsonDrawerVisible = true">查看 JSON</el-button>
        </div>
        <div class="table-header__right">
          <el-button :loading="loadingWorkbooks || loadingMetadata" @click="loadWorkbooks">刷新文件</el-button>
          <el-button :loading="loadingRecords" @click="loadRecords">刷新数据</el-button>
        </div>
      </div>

      <div class="xlsx-table-wrap" v-loading="loadingRecords">
        <sc-table v-if="records.length || loadingRecords" :schema="tableSchema" :setting="tableSetting">
          <template #dataCell="scope">
            <span class="xlsx-cell" :title="displayValue(scope.row[scope.column.property])">
              {{ displayValue(scope.row[scope.column.property]) }}
            </span>
          </template>
          <template #actions="scope">
            <div class="xlsx-row-actions">
              <el-button link type="primary" @click="openEdit(scope.row)">编辑</el-button>
              <el-button link type="danger" @click="removeRecord(scope.row)">删除</el-button>
            </div>
          </template>
        </sc-table>
        <el-empty v-else description="没有匹配的数据" />
      </div>

      <div class="xlsx-pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadRecords"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog
      v-model="recordDialogVisible"
      :title="editingRowNumber ? `编辑第 ${editingRowNumber} 行` : '新增记录'"
      width="min(680px, calc(100vw - 32px))"
      destroy-on-close
    >
      <sc-form ref="recordFormRef" :schema="recordSchema" :setting="recordFormSetting" />
      <template #footer>
        <el-button @click="recordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRecord">
          {{ editingRowNumber ? '保存修改' : '新增记录' }}
        </el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="jsonDrawerVisible" title="当前查询 JSON" size="min(720px, 92vw)">
      <div class="xlsx-json-meta">
        <span>{{ activeSheet || '未选择工作表' }}</span>
        <el-button size="small" @click="copyJson">复制 JSON</el-button>
      </div>
      <pre class="xlsx-json">{{ jsonPreview }}</pre>
    </el-drawer>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import { api } from '../api';
import SearchForm from '../components/SearchForm.vue';

defineOptions({ name: 'XlsxManager' });

const metadata = ref(null);
const workbooks = ref([]);
const activeWorkbook = ref('');
const columns = ref([]);
const records = ref([]);
const loadingWorkbooks = ref(false);
const loadingMetadata = ref(false);
const loadingRecords = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const recordDialogVisible = ref(false);
const jsonDrawerVisible = ref(false);
const editingRowNumber = ref(null);
const recordFormRef = ref(null);

const query = reactive({ sheet: '', keyword: '' });
const recordModel = reactive({});
const pagination = reactive({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
const activeSheet = computed(() => query.sheet);
const downloadUrl = computed(() => api.getWorkbookDownloadUrl(activeWorkbook.value));
let workbookRequestId = 0;
let metadataRequestId = 0;
let recordsRequestId = 0;

const recordFormSetting = {
  form: { labelPosition: 'top', size: 'default', class: 'xlsx-record-form' },
  item: {}, input: { clearable: true }, select: {},
};

const tableSetting = {
  table: {
    border: false,
    height: '100%',
    rowKey: (row) => row._rowNumber,
    tableLayout: 'fixed',
    stripe: true,
  },
  column: { align: 'left' },
};

const searchSchema = computed(() => ({
  colSpan: 6,
  gutter: 16,
  model: query,
  formItems: [
    {
      type: 'select', field: 'sheet', label: '工作表', placeholder: '请选择工作表',
      options: (metadata.value?.sheets || []).map((sheet) => ({
        label: `${sheet.name}（${sheet.rowCount} 条）`, value: sheet.name,
      })),
      on: { change: handleSheetChange },
    },
    {
      type: 'input', field: 'keyword', label: '关键词', placeholder: '搜索当前工作表全部字段',
      on: { 'keyup.enter': applySearch },
    },
  ],
}));

const tableSchema = computed(() => ({
  data: records.value,
  columns: [
    { prop: '_rowNumber', label: '行号', width: 72, fixed: 'left', align: 'right' },
    ...columns.value.map((column, index) => ({
      prop: column.key,
      label: column.label,
      minWidth: column.type === 'number' ? 130 : 190,
      fixed: index === 0 ? 'left' : undefined,
      showOverflowTooltip: true,
      template: 'dataCell',
    })),
    { prop: 'operations', label: '操作', width: 130, fixed: 'right', align: 'right', template: 'actions' },
  ],
}));

const recordSchema = computed(() => ({
  model: recordModel,
  formItems: columns.value.map((column) => fieldSchema(column)),
}));

const jsonPreview = computed(() => JSON.stringify({
  success: true,
  data: {
    workbook: activeWorkbook.value,
    sheet: activeSheet.value,
    records: records.value,
    columns: columns.value,
    pagination: { ...pagination },
  },
}, null, 2));

function fieldSchema(column) {
  const common = { field: column.key, label: column.label, placeholder: `请输入${column.label}` };
  if (column.type === 'number') {
    return { ...common, type: 'input-number', controls: false, style: { width: '100%' } };
  }
  if (column.type === 'boolean') return { ...common, type: 'switch' };
  if (column.type === 'date') {
    return { ...common, type: 'date-picker', valueFormat: 'YYYY-MM-DD', style: { width: '100%' } };
  }
  return { ...common, type: 'input', maxlength: 1000 };
}

function clearRecordModel(source = {}) {
  Object.keys(recordModel).forEach((key) => delete recordModel[key]);
  columns.value.forEach((column) => {
    recordModel[column.key] = source[column.key] ?? (column.type === 'boolean' ? false : null);
  });
}

function resetWorkbookState() {
  metadata.value = null;
  query.sheet = '';
  query.keyword = '';
  records.value = [];
  columns.value = [];
  Object.assign(pagination, { page: 1, total: 0, totalPages: 1 });
}

async function loadWorkbooks() {
  const requestId = ++workbookRequestId;
  loadingWorkbooks.value = true;
  errorMessage.value = '';
  try {
    const response = await api.getWorkbooks();
    if (requestId !== workbookRequestId) return;
    workbooks.value = response.data.workbooks;
    const availableNames = new Set(workbooks.value.map((workbook) => workbook.fileName));
    if (!availableNames.has(activeWorkbook.value)) {
      activeWorkbook.value = response.data.defaultFileName || workbooks.value[0]?.fileName || '';
      resetWorkbookState();
    }
    if (activeWorkbook.value) await loadMetadata();
  } catch (error) {
    if (requestId === workbookRequestId) errorMessage.value = error.message;
  } finally {
    if (requestId === workbookRequestId) loadingWorkbooks.value = false;
  }
}

async function loadMetadata() {
  const workbookName = activeWorkbook.value;
  if (!workbookName) return;
  const requestId = ++metadataRequestId;
  loadingMetadata.value = true;
  errorMessage.value = '';
  try {
    const response = await api.getWorkbook(workbookName);
    if (requestId !== metadataRequestId || activeWorkbook.value !== workbookName) return;
    metadata.value = response.data;
    if (!query.sheet || !response.data.sheets.some((sheet) => sheet.name === query.sheet)) {
      query.sheet = response.data.sheets[0]?.name || '';
    }
    await loadRecords();
  } catch (error) {
    if (requestId === metadataRequestId) errorMessage.value = error.message;
  } finally {
    if (requestId === metadataRequestId) loadingMetadata.value = false;
  }
}

async function loadRecords() {
  const workbookName = activeWorkbook.value;
  const sheetName = query.sheet;
  if (!workbookName || !sheetName) return;
  const requestId = ++recordsRequestId;
  loadingRecords.value = true;
  errorMessage.value = '';
  try {
    const response = await api.getRecords(workbookName, sheetName, {
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: query.keyword.trim(),
    });
    if (
      requestId !== recordsRequestId
      || activeWorkbook.value !== workbookName
      || query.sheet !== sheetName
    ) return;
    records.value = response.data.records;
    columns.value = response.data.columns;
    Object.assign(pagination, response.data.pagination);
  } catch (error) {
    if (requestId === recordsRequestId) errorMessage.value = error.message;
  } finally {
    if (requestId === recordsRequestId) loadingRecords.value = false;
  }
}

async function handleWorkbookChange() {
  metadataRequestId += 1;
  recordsRequestId += 1;
  loadingMetadata.value = false;
  loadingRecords.value = false;
  resetWorkbookState();
  await loadMetadata();
}

function handleSheetChange() {
  pagination.page = 1;
  query.keyword = '';
  loadRecords();
}

function applySearch() { pagination.page = 1; loadRecords(); }
function resetSearch() { query.keyword = ''; pagination.page = 1; loadRecords(); }
function handlePageSizeChange() { pagination.page = 1; loadRecords(); }

function openCreate() {
  editingRowNumber.value = null;
  clearRecordModel();
  recordDialogVisible.value = true;
}

function openEdit(row) {
  editingRowNumber.value = row._rowNumber;
  clearRecordModel(row);
  recordDialogVisible.value = true;
}

async function saveRecord() {
  const form = recordFormRef.value?.getForm();
  const valid = await form?.validate().catch(() => false);
  if (valid === false) return;
  saving.value = true;
  try {
    const payload = Object.fromEntries(columns.value.map(({ key }) => [key, recordModel[key]]));
    if (editingRowNumber.value) {
      await api.updateRecord(activeWorkbook.value, query.sheet, editingRowNumber.value, payload);
      ElMessage.success('记录已保存到 XLSX');
    } else {
      await api.createRecord(activeWorkbook.value, query.sheet, payload);
      ElMessage.success('记录已新增到 XLSX');
    }
    recordDialogVisible.value = false;
    await loadMetadata();
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    saving.value = false;
  }
}

async function removeRecord(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除 Excel 第 ${row._rowNumber} 行吗？此操作会直接写入文件。`,
      '删除记录',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' },
    );
    await api.deleteRecord(activeWorkbook.value, query.sheet, row._rowNumber);
    ElMessage.success('记录已从 XLSX 删除');
    if (records.value.length === 1 && pagination.page > 1) pagination.page -= 1;
    await loadMetadata();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除失败');
  }
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(jsonPreview.value);
    ElMessage.success('JSON 已复制');
  } catch {
    ElMessage.warning('浏览器未允许访问剪贴板');
  }
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

onMounted(loadWorkbooks);
</script>

<style scoped>
.xlsx-page {
  max-width: 1480px;
  margin: 0 auto;
}
.xlsx-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
.xlsx-eyebrow { margin: 0 0 6px; color: #217346; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.xlsx-header h1 { margin: 0; color: #172033; font-size: clamp(26px, 3vw, 36px); line-height: 1.2; letter-spacing: -.02em; }
.xlsx-description { max-width: 720px; margin: 10px 0 0; color: #667085; font-size: 14px; line-height: 1.7; }
.xlsx-alert { margin-bottom: 16px; }
.xlsx-workbook-switcher { min-height: 96px; margin-bottom: 16px; padding: 14px 20px 0; border: 1px solid #e3e8ef; border-radius: 10px; background: #fff; box-shadow: 0 2px 5px rgb(64 68 82 / 5%), 0 1px 2px rgb(64 68 82 / 4%); }
.xlsx-workbook-switcher__heading { display: flex; align-items: baseline; gap: 8px; }
.xlsx-workbook-switcher__heading h2 { margin: 0; color: #344054; font-size: 14px; font-weight: 600; }
.xlsx-workbook-switcher__heading p { margin: 0; color: #8a94a6; font-size: 12px; font-variant-numeric: tabular-nums; }
.xlsx-workbook-tabs { margin-top: 4px; }
.xlsx-workbook-tabs :deep(.el-tabs__header) { margin: 0; }
.xlsx-workbook-tabs :deep(.el-tabs__content) { display: none; }
.xlsx-workbook-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; background-color: #eef1f5; }
.xlsx-workbook-tabs :deep(.el-tabs__item) { max-width: 280px; height: 44px; padding: 0 18px; color: #667085; }
.xlsx-workbook-tabs :deep(.el-tabs__item:hover),
.xlsx-workbook-tabs :deep(.el-tabs__item:focus-visible) { color: #185a37; }
.xlsx-workbook-tabs :deep(.el-tabs__item.is-active) { color: #185a37; font-weight: 600; }
.xlsx-workbook-tab { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xlsx-workbook-switcher :deep(.el-empty) { padding: 8px 0 18px; }
.xlsx-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 16px; overflow: hidden; border: 1px solid #e3e8ef; border-radius: 12px; background: #fff; }
.xlsx-metric { min-width: 0; padding: 18px 20px; border-right: 1px solid #eef1f5; }
.xlsx-metric:last-child { border-right: 0; }
.xlsx-metric span, .xlsx-metric strong { display: block; }
.xlsx-metric span { margin-bottom: 7px; color: #8a94a6; font-size: 12px; }
.xlsx-metric strong { overflow: hidden; color: #172033; font-size: 20px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.xlsx-panel { border: 1px solid #e3e8ef; border-radius: 12px; background: #fff; }
.xlsx-filter { display: flex; align-items: flex-end; gap: 16px; margin-bottom: 16px; padding: 18px 20px 2px; }
.xlsx-filter__form { flex: 1 1 auto; min-width: 0; }
.xlsx-table-panel { display: flex; height: max(520px, calc(100vh - 360px)); max-height: 760px; overflow: hidden; flex-direction: column; }
.xlsx-table-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 72px; padding: 14px 20px; border-bottom: 1px solid #eef1f5; }
.xlsx-table-heading h2 { margin: 0; color: #172033; font-size: 16px; }
.xlsx-table-heading p, .xlsx-updated { margin: 5px 0 0; color: #8a94a6; font-size: 12px; }
.table-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; border-bottom: 1px solid #eef1f5; }
.table-header__left, .table-header__right { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.table-header__right { flex: 0 0 auto; margin-left: auto; }
.table-header :deep(.el-button + .el-button) { margin-left: 0; }
.xlsx-table-wrap { flex: 1 1 auto; height: auto; min-height: 0; overflow: hidden; }
.xlsx-table-wrap :deep(.el-table) { height: 100% !important; --el-table-header-bg-color: #f8fafc; --el-table-row-hover-bg-color: #f2f8f4; color: #344054; }
.xlsx-table-wrap :deep(.el-table th.el-table__cell) { height: 46px; color: #667085; font-size: 12px; font-weight: 600; }
.xlsx-cell { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.xlsx-row-actions { display: flex; justify-content: flex-end; gap: 12px; }
.xlsx-pagination { display: flex; flex: 0 0 auto; justify-content: flex-end; padding: 16px 20px; border-top: 1px solid #eef1f5; background: #fff; }
.xlsx-record-form :deep(.el-input-number) { width: 100%; }
.xlsx-json-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; color: #667085; font-size: 13px; }
.xlsx-json { min-height: 320px; margin: 0; padding: 18px; overflow: auto; border: 1px solid #dfe5ec; border-radius: 8px; color: #d7e1f3; background: #121826; font: 12px/1.65 "SFMono-Regular", Consolas, monospace; white-space: pre-wrap; word-break: break-word; }

@media (max-width: 1100px) {
  .xlsx-filter { display: block; }
}

@media (max-width: 760px) {
  .xlsx-header { display: block; }
  .xlsx-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .xlsx-metric:nth-child(2) { border-right: 0; }
  .xlsx-metric:nth-child(-n + 2) { border-bottom: 1px solid #eef1f5; }
  .table-header { align-items: flex-start; flex-wrap: wrap; }
  .xlsx-table-panel { height: 600px; }
  .xlsx-pagination { justify-content: flex-start; }
  .xlsx-table-heading { align-items: flex-start; }
  .xlsx-updated { display: none; }
  .xlsx-pagination { overflow-x: auto; }
}
</style>
