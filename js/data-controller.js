/* ========== DataController 模块（导入导出） ========== */
const DataController = {
 pendingImportData: null,

 init() {
 var self = this;

 document.getElementById('btnExportData').addEventListener('click', function() {
 self.handleExport();
 });

 document.getElementById('btnImportData').addEventListener('click', function() {
 document.getElementById('importFileInput').click();
 });

 document.getElementById('importFileInput').addEventListener('change', function(e) {
 self.handleFileSelect(e);
 });

 document.getElementById('btnConfirmImport').addEventListener('click', function() {
 self.confirmImport();
 });

 document.getElementById('btnCancelImport').addEventListener('click', function() {
 self.cancelImport();
 });

 document.getElementById('importConfirmOverlay').addEventListener('click', function(e) {
/*点击外部不关闭*/
 });
 },

 handleExport() {
 try {
 Store.exportAll().then(function(jsonStr) {
 var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
 var url = URL.createObjectURL(blob);
 var a = document.createElement('a');
 var now = new Date();
 var dateStr = now.getFullYear() + '-' +
 String(now.getMonth() + 1).padStart(2, '0') + '-' +
 String(now.getDate()).padStart(2, '0');
 a.href = url;
 a.download = '缝纫管理数据_' + dateStr + '.json';
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 Toast.show('数据导出成功', 'success');
 }).catch(function(e) {
 console.error('Export error:', e);
 Toast.show('数据导出失败', 'error');
 });
 } catch(e) {
 console.error('Export error:', e);
 Toast.show('数据导出失败', 'error');
 }
 },

 handleFileSelect(e) {
 var self = this;
 var file = e.target.files[0];
 if (!file) { return; }

 if (!file.name.endsWith('.json')) {
 Toast.show('请选择 JSON 格式文件', 'error');
 e.target.value = '';
 return;
 }

 var reader = new FileReader();
 reader.onload = function(ev) {
 try {
 var parsed = JSON.parse(ev.target.result);
 if (!parsed.version || !parsed.data) {
 Toast.show('文件格式无效：缺少版本号或数据字段', 'error');
 return;
 }
 self.pendingImportData = ev.target.result;
 document.getElementById('importConfirmOverlay').classList.add('show');
 } catch(err) {
 Toast.show('文件解析失败：不是有效的 JSON 文件', 'error');
 }
 };
 reader.onerror = function() {
 Toast.show('文件读取失败', 'error');
 };
 reader.readAsText(file);
 e.target.value = '';
 },

 confirmImport() {
 var self = this;
 if (!this.pendingImportData) { return; }

 Store.importAll(this.pendingImportData).then(function(success) {
 self.pendingImportData = null;
 document.getElementById('importConfirmOverlay').classList.remove('show');

 if (success) {
 Toast.show('数据导入成功', 'success');
 self.refreshAllPages();
 } else {
 Toast.show('数据导入失败', 'error');
 }
 });
 },

 cancelImport() {
 this.pendingImportData = null;
 document.getElementById('importConfirmOverlay').classList.remove('show');
 },

 refreshAllPages() {
 OptionController._ensureInitialized();
 FabricController.renderList();
 ProductController.renderList();
 TodoController.renderList();
 PatternController.renderList();
 NotionController.renderList();
 var currentPage = Router.getCurrentPage();
 if (currentPage === 'dashboard') {
 DashboardController.refresh();
 }
 if (currentPage === 'print') {
 PrintController.selectedIds.clear();
 PrintController.refresh();
 }
 }
};

