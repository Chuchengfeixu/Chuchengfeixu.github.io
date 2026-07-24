/* ========== PrintController 模块 ========== */
const PrintController = {
 selectedIds: new Set(),
 printedExpanded: false,

 init() {
 var self = this;

 document.getElementById('printSelectAll').addEventListener('change', function() {
 self.toggleSelectAll(this.checked);
 });

 document.getElementById('btnPrint').addEventListener('click', function() {
 window.print();
 /* 标记已选布料为已打印 */
 var now = new Date().toISOString();
 self.selectedIds.forEach(function(id) {
 Store.update(Store.KEYS.FABRICS, id, { printed: true, printedAt: now });
 });
 self.selectedIds.clear();
 self.refresh();
 Toast.show('已标记为已打印', 'success');
 });

 Router.onNavigate(function(page) {
 if (page === 'print') {
 self.refresh();
 }
 });
 },

 refresh() {
 this.renderChecklist();
 this.renderPreview();
 },

 renderChecklist() {
 var self = this;
 var fabrics = Store.getAll(Store.KEYS.FABRICS);
 var container = document.getElementById('printFabricChecklist');
 var selectAllCb = document.getElementById('printSelectAll');

 if (fabrics.length === 0) {
 container.innerHTML = '<div class="print-empty">暂无布料记录</div>';
 selectAllCb.checked = false;
 return;
 }

 var unprinted = fabrics.filter(function(f) { return !f.printed; });
 var printed = fabrics.filter(function(f) { return f.printed === true; });
 printed.sort(function(a, b) {
 var ta = a.printedAt || '';
 var tb = b.printedAt || '';
 return tb.localeCompare(ta);
 });

 /* 首次进入时，默认选中所有未打印布料 */
 if (this.selectedIds.size === 0 && unprinted.length > 0) {
 unprinted.forEach(function(f) { self.selectedIds.add(f.id); });
 }

 var html = '';

 /* 未打印布料区域 */
 if (unprinted.length > 0) {
 html += '<div class="print-section-title">未打印布料</div>';
 html += '<div class="print-fabric-checklist" style="margin-bottom:0;">';
 unprinted.forEach(function(f) {
 var checked = self.selectedIds.has(f.id) ? 'checked' : '';
 html += '<label class="print-fabric-check-item">';
 html += '<input type="checkbox" data-fabric-id="' + f.id + '" ' + checked + '>';
 html += '<span><span class="fabric-check-name">' + self.escapeHtml(f.name) + '</span>';
 if (f.shop) {
 html += ' <span class="fabric-check-shop">(' + self.escapeHtml(f.shop) + ')</span>';
 }
 html += '</span></label>';
 });
 html += '</div>';
 } else {
 html += '<div class="print-section-title">未打印布料</div>';
 html += '<div style="padding:12px;color:var(--text-light);font-size:13px;">所有布料均已打印</div>';
 }

 /* 已打印布料区域 */
 if (printed.length > 0) {
 var expandedClass = self.printedExpanded ? ' expanded' : '';
 var arrowChar = '▶';
 var displayStyle = self.printedExpanded ? 'display:grid;' : 'display:none;';
 html += '<div class="print-section-toggle' + expandedClass + '" id="printedToggle">';
 html += '已打印布料 (' + printed.length + '条) <span class="toggle-arrow">' + arrowChar + '</span>';
 html += '</div>';
 html += '<div class="print-fabric-checklist print-printed-list" style="' + displayStyle + 'margin-bottom:0;">';
 printed.forEach(function(f) {
 var checked = self.selectedIds.has(f.id) ? 'checked' : '';
 html += '<div class="print-fabric-check-item" style="justify-content:space-between;">';
 html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-width:0;">';
 html += '<input type="checkbox" data-fabric-id="' + f.id + '" ' + checked + '>';
 html += '<span><span class="fabric-check-name">' + self.escapeHtml(f.name) + '</span>';
 if (f.shop) {
 html += ' <span class="fabric-check-shop">(' + self.escapeHtml(f.shop) + ')</span>';
 }
 html += '</span></label>';
 html += '<button type="button" class="btn-unprint" data-fabric-id="' + f.id + '" style="background:none;border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:11px;color:var(--text-light);cursor:pointer;flex-shrink:0;transition:all 0.15s;" onmouseover="this.style.borderColor=\'var(--orange)\';this.style.color=\'var(--orange)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--text-light)\'">标记为未打印</button>';
 html += '</div>';
 });
 html += '</div>';
 }

 container.innerHTML = html;

 /* 绑定折叠切换事件 */
 var toggle = document.getElementById('printedToggle');
 if (toggle) {
 toggle.addEventListener('click', function() {
 self.printedExpanded = !self.printedExpanded;
 var list = container.querySelector('.print-printed-list');
 if (self.printedExpanded) {
 toggle.classList.add('expanded');
 list.style.display = 'grid';
 } else {
 toggle.classList.remove('expanded');
 list.style.display = 'none';
 }
 });
 }

 /* 绑定复选框事件 */
 var checkboxes = container.querySelectorAll('input[type="checkbox"]');
 checkboxes.forEach(function(cb) {
 cb.addEventListener('change', function() {
 var fid = this.getAttribute('data-fabric-id');
 if (this.checked) {
 self.selectedIds.add(fid);
 } else {
 self.selectedIds.delete(fid);
 }
 self.updateSelectAllState();
 self.renderPreview();
 });
 });

 /* 绑定"标记为未打印"按钮 */
 var unprintBtns = container.querySelectorAll('.btn-unprint');
 unprintBtns.forEach(function(btn) {
 btn.addEventListener('click', function(e) {
 e.stopPropagation();
 var fid = this.getAttribute('data-fabric-id');
 Store.update(Store.KEYS.FABRICS, fid, { printed: false, printedAt: '' });
 self.selectedIds.delete(fid);
 Toast.show('已标记为未打印', 'success');
 self.refresh();
 });
 });

 this.updateSelectAllState();
 },

 toggleSelectAll(checked) {
 var self = this;
 var fabrics = Store.getAll(Store.KEYS.FABRICS);
 this.selectedIds.clear();
 if (checked) {
 fabrics.forEach(function(f) { self.selectedIds.add(f.id); });
 }
 var checkboxes = document.querySelectorAll('#printFabricChecklist input[type="checkbox"]');
 checkboxes.forEach(function(cb) { cb.checked = checked; });
 this.renderPreview();
 },

 updateSelectAllState() {
 var fabrics = Store.getAll(Store.KEYS.FABRICS);
 var selectAllCb = document.getElementById('printSelectAll');
 selectAllCb.checked = fabrics.length > 0 && this.selectedIds.size === fabrics.length;
 },

 renderPreview() {
 var self = this;
 var fabrics = Store.getAll(Store.KEYS.FABRICS);
 var container = document.getElementById('printSlipGrid');

 var selected = fabrics.filter(function(f) { return self.selectedIds.has(f.id); });

 if (selected.length === 0) {
 container.innerHTML = '<div class="print-empty">请选择需要打印的布料</div>';
 return;
 }

 var html = '';
 selected.forEach(function(f) {
 html += self.renderSlip(f);
 });
 container.innerHTML = html;
 },

 renderSlip(fabric) {
 var html = '<div class="print-slip">';
 html += '<div class="print-slip-name">' + this.escapeHtml(fabric.name) + '</div>';
 html += '<div class="print-slip-row"><span class="print-slip-label">店铺</span><span class="print-slip-value">' + this.escapeHtml(fabric.shop || '-') + '</span></div>';
 html += '<div class="print-slip-row"><span class="print-slip-label">编号</span><span class="print-slip-value">' + this.escapeHtml(fabric.code || '-') + '</span></div>';
 html += '<div class="print-slip-row"><span class="print-slip-label">规格</span><span class="print-slip-value">' + fabric.meters + '米 × ' + this.escapeHtml(fabric.width || '-') + '</span></div>';
 html += '<div class="print-slip-row"><span class="print-slip-label">价格</span><span class="print-slip-value">¥' + fabric.price + '</span></div>';
 html += '<div class="print-slip-row"><span class="print-slip-label">日期</span><span class="print-slip-value">' + this.escapeHtml(fabric.purchaseDate || '-') + '</span></div>';
 html += '</div>';
 return html;
 },

 escapeHtml(str) {
 if (!str) { return ''; }
 var div = document.createElement('div');
 div.textContent = str;
 return div.innerHTML;
 }
};

