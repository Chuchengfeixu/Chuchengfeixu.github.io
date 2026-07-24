/* ========== DeleteConfirm 模块 ========== */
const DeleteConfirm = {
 _callback: null,

 init() {
 var self = this;
 document.getElementById('btnCancelDelete').addEventListener('click', function() {
 self.close();
 });
 document.getElementById('btnConfirmDelete').addEventListener('click', function() {
 if (self._callback) { self._callback(); }
 self.close();
 });
 },

 show(message, callback) {
 this._callback = callback;
 document.getElementById('deleteConfirmMessage').textContent = message;
 document.getElementById('deleteConfirmOverlay').classList.add('show');
 },

 close() {
 document.getElementById('deleteConfirmOverlay').classList.remove('show');
 this._callback = null;
 }
};

/* ========== PageFilter 模块（页面内筛选） ========== */
const PageFilter = {
 filters: { fabric: {}, product: {}, todo: {}, pattern: {}, notion: {} },

 FIELDS: {
 fabric: [
 { key: 'name', label: '名称', type: 'text' },
 { key: 'shop', label: '店铺', type: 'option', optionField: 'fabricShop' },
 { key: 'code', label: '编号', type: 'text' },
 { key: 'width', label: '幅宽', type: 'option', optionField: 'fabricWidth' },
 { key: 'weight', label: '克重', type: 'text' },
 { key: 'quality', label: '评级', type: 'select', options: ['1','2','3','4','5'] },
 { key: 'purchaseDate', label: '购买日期', type: 'dateRange' },
 { key: 'price', label: '价格', type: 'numberRange' }
 ],
 product: [
 { key: 'name', label: '名称', type: 'text' },
 { key: 'category', label: '类别', type: 'option', optionField: 'productCategory' },
 { key: 'user', label: '使用者', type: 'option', optionField: 'productUser' },
 { key: 'patternSource', label: '纸样来源', type: 'option', optionField: 'patternSource' },
 { key: 'patternCode', label: '纸样编号', type: 'text' },
 { key: 'completedDate', label: '完成日期', type: 'dateRange' }
 ],
 todo: [
 { key: 'name', label: '名称', type: 'text' },
 { key: 'category', label: '类别', type: 'option', optionField: 'productCategory' },
 { key: 'user', label: '使用者', type: 'option', optionField: 'productUser' },
 { key: 'patternSource', label: '纸样来源', type: 'option', optionField: 'patternSource' },
 { key: 'plannedDate', label: '计划日期', type: 'dateRange' },
 { key: 'note', label: '备注', type: 'text' }
 ],
 pattern: [
 { key: 'name', label: '名称', type: 'text' },
 { key: 'brand', label: '来源/品牌', type: 'option', optionField: 'patternBrand' },
 { key: 'code', label: '编号', type: 'text' },
 { key: 'category', label: '类别', type: 'option', optionField: 'patternCategory' },
 { key: 'note', label: '备注', type: 'text' }
 ],
 notion: [
 { key: 'name', label: '名称', type: 'text' },
 { key: 'category', label: '类别', type: 'option', optionField: 'notionCategory' },
 { key: 'shop', label: '店铺', type: 'option', optionField: 'notionShop' },
 { key: 'purchaseDate', label: '购买日期', type: 'dateRange' },
 { key: 'price', label: '价格', type: 'numberRange' }
 ]
 },

 renderBar(page) {
 var self = this;
 var containerId = page + 'FilterBar';
 var container = document.getElementById(containerId);
 if (!container) return;
 var fields = this.FIELDS[page] || [];
 if (fields.length === 0) { container.innerHTML = ''; return; }

 var html = '<span class="filter-label">筛选：</span>';
 fields.forEach(function(field) {
 var val = self.filters[page][field.key] || '';
 if (field.type === 'text') {
 html += '<input type="text" placeholder="' + field.label + '" data-page="' + page + '" data-key="' + field.key + '" value="' + self.escapeAttr(val) + '" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;width:80px;outline:none;">';
 } else if (field.type === 'option') {
 var options = OptionController.getOptions(field.optionField);
 html += '<select data-page="' + page + '" data-key="' + field.key + '" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;outline:none;">';
 html += '<option value="">' + field.label + '</option>';
 options.forEach(function(opt) {
 html += '<option value="' + self.escapeAttr(opt) + '"' + (val === opt ? ' selected' : '') + '>' + self.escapeAttr(opt) + '</option>';
 });
 html += '</select>';
 } else if (field.type === 'select') {
 html += '<select data-page="' + page + '" data-key="' + field.key + '" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;outline:none;">';
 html += '<option value="">' + field.label + '</option>';
 field.options.forEach(function(opt) {
 html += '<option value="' + opt + '"' + (val === opt ? ' selected' : '') + '>' + opt + (field.key === 'quality' ? '★' : '') + '</option>';
 });
 html += '</select>';
 } else if (field.type === 'dateRange') {
 var from = (self.filters[page][field.key + '_from']) || '';
 var to = (self.filters[page][field.key + '_to']) || '';
 html += '<span style="font-size:12px;color:var(--text-light);">' + field.label + '：</span>';
 html += '<input type="date" data-page="' + page + '" data-key="' + field.key + '_from" value="' + from + '" style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;outline:none;" title="起始日期">';
 html += '<span style="font-size:12px;color:var(--text-light);">~</span>';
 html += '<input type="date" data-page="' + page + '" data-key="' + field.key + '_to" value="' + to + '" style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;outline:none;" title="结束日期">';
 } else if (field.type === 'numberRange') {
 var min = (self.filters[page][field.key + '_min']) || '';
 var max = (self.filters[page][field.key + '_max']) || '';
 html += '<span style="font-size:12px;color:var(--text-light);">' + field.label + '：</span>';
 html += '<input type="number" placeholder="最低" data-page="' + page + '" data-key="' + field.key + '_min" value="' + min + '" style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;width:60px;outline:none;" step="0.01">';
 html += '<span style="font-size:12px;color:var(--text-light);">~</span>';
 html += '<input type="number" placeholder="最高" data-page="' + page + '" data-key="' + field.key + '_max" value="' + max + '" style="padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;width:60px;outline:none;" step="0.01">';
 }
 });

 var hasAny = Object.values(self.filters[page]).some(function(v) { return v !== ''; });
 if (hasAny) {
 html += '<button type="button" data-page="' + page + '" data-action="clear" style="padding:4px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;cursor:pointer;background:#fff;color:var(--text-light);">清除</button>';
 }

 container.innerHTML = html;

 container.querySelectorAll('input, select').forEach(function(el) {
 var evType = (el.tagName === 'SELECT' || el.type === 'date' || el.type === 'number') ? 'change' : 'input';
 el.addEventListener(evType, function() {
 var p = this.getAttribute('data-page');
 var k = this.getAttribute('data-key');
 self.filters[p][k] = this.value;
 self.triggerRender(p);
 });
 });

 var clearBtn = container.querySelector('[data-action="clear"]');
 if (clearBtn) {
 clearBtn.addEventListener('click', function() {
 var p = this.getAttribute('data-page');
 self.filters[p] = {};
 self['_rendered_' + p] = false;
 self.renderBar(p);
 self['_rendered_' + p] = true;
 self.triggerRender(p);
 });
 }
 },

 matchItem(page, item) {
 var self = this;
 var fields = this.FIELDS[page] || [];
 for (var i = 0; i < fields.length; i++) {
 var field = fields[i];
 if (field.type === 'text') {
 var val = self.filters[page][field.key] || '';
 if (val && (item[field.key] || '').toLowerCase().indexOf(val.toLowerCase()) === -1) return false;
 } else if (field.type === 'option' || field.type === 'select') {
 var val = self.filters[page][field.key] || '';
 if (val && (item[field.key] || '') !== val) return false;
 } else if (field.type === 'dateRange') {
 var from = self.filters[page][field.key + '_from'] || '';
 var to = self.filters[page][field.key + '_to'] || '';
 var dateVal = item[field.key] || '';
 if (from && dateVal < from) return false;
 if (to && dateVal > to) return false;
 } else if (field.type === 'numberRange') {
 var min = self.filters[page][field.key + '_min'] || '';
 var max = self.filters[page][field.key + '_max'] || '';
 var numVal = parseFloat(item[field.key]) || 0;
 if (min !== '' && numVal < parseFloat(min)) return false;
 if (max !== '' && numVal > parseFloat(max)) return false;
 }
 }
 return true;
 },

 triggerRender(page) {
 if (page === 'fabric') FabricController.renderList();
 else if (page === 'product') ProductController.renderList();
 else if (page === 'todo') TodoController.renderList();
 else if (page === 'pattern') PatternController.renderList();
 else if (page === 'notion') NotionController.renderList();
 },

 escapeAttr(str) {
 if (!str) return '';
 return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
 }
};

