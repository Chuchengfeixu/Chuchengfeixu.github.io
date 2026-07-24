/* ========== HomeController 模块 ========== */
const HomeController = {
 FILTER_STORAGE_KEY: 'sewing_home_filters',
 currentScope: 'all',
 currentFilters: {},

 init() {
 var self = this;
 var searchInput = document.getElementById('homeSearchInput');
 var scopeSelect = document.getElementById('homeSearchScope');

 searchInput.addEventListener('input', function() { self.doSearch(); });
 scopeSelect.addEventListener('change', function() {
 self.currentScope = this.value;
 self.renderFilterBar();
 self.doSearch();
 });

 Router.onNavigate(function(page) {
 if (page === 'home') {
 self.renderFilterBar();
 self.doSearch();
 }
 });
 },

 escapeHtml(str) {
 if (!str) { return ''; }
 var div = document.createElement('div');
 div.textContent = str;
 return div.innerHTML;
 },

 getFilterFields(scope) {
 var fields = {
 fabric: [
 { key: 'shop', label: '店铺', optionField: 'fabricShop' },
 { key: 'width', label: '幅宽', optionField: 'fabricWidth' }
 ],
 product: [
 { key: 'category', label: '类别', optionField: 'productCategory' },
 { key: 'user', label: '使用者', optionField: 'productUser' },
 { key: 'patternSource', label: '纸样来源', optionField: 'patternSource' }
 ],
 todo: [
 { key: 'category', label: '类别', optionField: 'productCategory' },
 { key: 'user', label: '使用者', optionField: 'productUser' }
 ]
 };
 if (scope === 'all') {
 return [
 { key: 'f_shop', label: '布料店铺', optionField: 'fabricShop', scope: 'fabric', dataKey: 'shop' },
 { key: 'p_category', label: '制品类别', optionField: 'productCategory', scope: 'product', dataKey: 'category' },
 { key: 'p_user', label: '使用者', optionField: 'productUser', scope: 'product', dataKey: 'user' }
 ];
 }
 return fields[scope] || [];
 },

 renderFilterBar() {
 var self = this;
 var container = document.getElementById('homeFilterBar');
 var fields = this.getFilterFields(this.currentScope);

 if (fields.length === 0) {
 container.innerHTML = '';
 return;
 }

 var html = '<span class="filter-label">筛选：</span>';
 fields.forEach(function(field) {
 var options = OptionController.getOptions(field.optionField);
 html += '<select data-filter-key="' + field.key + '">';
 html += '<option value="">' + field.label + '（全部）</option>';
 options.forEach(function(opt) {
 var selected = (self.currentFilters[field.key] === opt) ? ' selected' : '';
 html += '<option value="' + self.escapeHtml(opt) + '"' + selected + '>' + self.escapeHtml(opt) + '</option>';
 });
 html += '</select>';
 });

 container.innerHTML = html;

 container.querySelectorAll('select').forEach(function(sel) {
 sel.addEventListener('change', function() {
 var key = this.getAttribute('data-filter-key');
 self.currentFilters[key] = this.value;
 self.doSearch();
 });
 });
 },

 matchesFilters(item, scope) {
 var self = this;
 var fields = this.getFilterFields(this.currentScope);
 for (var i = 0; i < fields.length; i++) {
 var field = fields[i];
 var filterVal = self.currentFilters[field.key];
 if (!filterVal) continue;
 var actualScope = field.scope || scope;
 if (actualScope !== scope) continue;
 var dataKey = field.dataKey || field.key;
 if (item[dataKey] !== filterVal) return false;
 }
 return true;
 },

 doSearch() {
 var query = document.getElementById('homeSearchInput').value.trim().toLowerCase();
 var scope = this.currentScope;
 var results = { fabric: [], product: [], todo: [] };

 if (scope === 'all' || scope === 'fabric') {
 var fabrics = Store.getAll(Store.KEYS.FABRICS);
 var products = Store.getAll(Store.KEYS.PRODUCTS);
 var scraps = Store.getAll(Store.KEYS.SCRAPS);
 fabrics.forEach(function(f) {
 var searchStr = [f.name, f.shop, f.code, f.width, f.weight].join(' ').toLowerCase();
 if ((!query || searchStr.indexOf(query) !== -1) && HomeController.matchesFilters(f, 'fabric')) {
 var remaining = Calculator.remainingMeters(f.id, f.meters, products, scraps);
 f._remaining = remaining;
 results.fabric.push(f);
 }
 });
 }

 if (scope === 'all' || scope === 'product') {
 var allProducts = Store.getAll(Store.KEYS.PRODUCTS);
 allProducts.forEach(function(p) {
 var searchStr = [p.name, p.category, p.user, p.patternSource, p.patternCode].join(' ').toLowerCase();
 if ((!query || searchStr.indexOf(query) !== -1) && HomeController.matchesFilters(p, 'product')) {
 results.product.push(p);
 }
 });
 }

 if (scope === 'all' || scope === 'todo') {
 var todos = Store.getAll(Store.KEYS.TODOS).filter(function(t) { return !t.completed; });
 todos.forEach(function(t) {
 var searchStr = [t.name, t.category, t.user, t.note, t.patternSource].join(' ').toLowerCase();
 if ((!query || searchStr.indexOf(query) !== -1) && HomeController.matchesFilters(t, 'todo')) {
 results.todo.push(t);
 }
 });
 }

 if (scope === 'all' || scope === 'pattern') {
 var patterns = Store.getAll(Store.KEYS.PATTERNS);
 patterns.forEach(function(p) {
 var searchStr = [p.name, p.brand, p.code, p.category, p.note].join(' ').toLowerCase();
 if (!query || searchStr.indexOf(query) !== -1) { results.pattern = results.pattern || []; results.pattern.push(p); }
 });
 }

 if (scope === 'all' || scope === 'notion') {
 var notions = Store.getAll(Store.KEYS.NOTIONS);
 notions.forEach(function(n) {
 var searchStr = [n.name, n.category, n.shop].join(' ').toLowerCase();
 if (!query || searchStr.indexOf(query) !== -1) { results.notion = results.notion || []; results.notion.push(n); }
 });
 }

 this.renderResults(results, query);
 },

 renderResults(results, query) {
 var self = this;
 var container = document.getElementById('homeResults');
 var totalCount = results.fabric.length + results.product.length + results.todo.length + (results.pattern || []).length + (results.notion || []).length;

 if (totalCount === 0) {
 container.innerHTML = '<div class="home-empty">没有找到匹配的结果</div>';
 return;
 }

 var html = '';

 if (results.fabric.length > 0) {
 html += '<div class="home-results-section">';
 html += '<div class="home-results-title fabric">布料（' + results.fabric.length + '）</div>';
 results.fabric.forEach(function(f) {
 html += '<div class="home-result-item" onclick="Router.navigate(\'fabric\');setTimeout(function(){FabricController.openForm(\'' + f.id + '\')},100);">';
 html += '<div><span class="home-result-name">' + self.escapeHtml(f.name) + '</span>';
 html += ' <span class="home-result-meta">' + self.escapeHtml(f.shop || '') + '</span></div>';
 html += '<div><span class="home-result-meta">剩余 ' + f._remaining + ' 米 · ¥' + f.price + '</span></div>';
 html += '</div>';
 });
 html += '</div>';
 }

 if (results.product.length > 0) {
 html += '<div class="home-results-section">';
 html += '<div class="home-results-title product">制品（' + results.product.length + '）</div>';
 results.product.forEach(function(p) {
 html += '<div class="home-result-item" onclick="Router.navigate(\'product\');setTimeout(function(){ProductController.openForm(\'' + p.id + '\')},100);">';
 html += '<div><span class="home-result-name">' + self.escapeHtml(p.name) + '</span>';
 html += ' <span class="home-result-meta">' + self.escapeHtml(p.category || '') + '</span></div>';
 html += '<div><span class="home-result-meta">' + self.escapeHtml(p.completedDate || '') + ' · ' + self.escapeHtml(p.user || '') + '</span></div>';
 html += '</div>';
 });
 html += '</div>';
 }

 if (results.todo.length > 0) {
 html += '<div class="home-results-section">';
 html += '<div class="home-results-title todo">待做（' + results.todo.length + '）</div>';
 results.todo.forEach(function(t) {
 html += '<div class="home-result-item" onclick="Router.navigate(\'todo\');setTimeout(function(){TodoController.openForm(\'' + t.id + '\')},100);">';
 html += '<div><span class="home-result-name">' + self.escapeHtml(t.name) + '</span>';
 html += ' <span class="home-result-meta">' + self.escapeHtml(t.category || '') + '</span></div>';
 html += '<div><span class="home-result-meta">' + self.escapeHtml(t.note || '') + '</span></div>';
 html += '</div>';
 });
 html += '</div>';
 }

 if ((results.pattern || []).length > 0) {
 html += '<div class="home-results-section">';
 html += '<div class="home-results-title" style="color:var(--teal-dark);border-bottom-color:var(--teal);">纸样（' + results.pattern.length + '）</div>';
 results.pattern.forEach(function(p) {
 html += '<div class="home-result-item" onclick="Router.navigate(\'pattern\');setTimeout(function(){PatternController.openForm(\'' + p.id + '\')},100);">';
 html += '<div><span class="home-result-name">' + self.escapeHtml(p.name) + '</span>';
 html += ' <span class="home-result-meta">' + self.escapeHtml(p.brand || '') + '</span></div>';
 html += '<div><span class="home-result-meta">' + self.escapeHtml(p.category || '') + '</span></div>';
 html += '</div>';
 });
 html += '</div>';
 }

 if ((results.notion || []).length > 0) {
 html += '<div class="home-results-section">';
 html += '<div class="home-results-title" style="color:var(--amber-dark);border-bottom-color:var(--amber);">辅料（' + results.notion.length + '）</div>';
 results.notion.forEach(function(n) {
 html += '<div class="home-result-item" onclick="Router.navigate(\'notion\');setTimeout(function(){NotionController.openForm(\'' + n.id + '\')},100);">';
 html += '<div><span class="home-result-name">' + self.escapeHtml(n.name) + '</span>';
 html += ' <span class="home-result-meta">' + self.escapeHtml(n.category || '') + '</span></div>';
 html += '<div><span class="home-result-meta">¥' + (n.price || '-') + '</span></div>';
 html += '</div>';
 });
 html += '</div>';
 }

 container.innerHTML = html;
 }
};

/* ========== 存储空间检查工具 ========== */
function checkStorageAndWarn() {
 var quota = Store.checkStorageQuota();
 if (quota && quota.available < 500 * 1024) {
 Toast.show('⚠️ 存储空间不足（剩余 ' + Math.round(quota.available / 1024) + 'KB），建议导出数据备份', 'warning');
 }
}

/* ========== 迁移：将 localStorage 中的 base64 图片迁移到 IndexedDB ========== */
function migrateImagesToIDB() {
 var keys = [Store.KEYS.FABRICS, Store.KEYS.PRODUCTS, Store.KEYS.TODOS, Store.KEYS.PATTERNS, Store.KEYS.NOTIONS];
 keys.forEach(function(storeKey) {
 var items = Store.getAll(storeKey);
 var changed = false;
 items.forEach(function(item) {
 if (item.image && !item.image.startsWith('idb:') && item.image.startsWith('data:')) {
 var imageKey = 'img_' + generateUUID();
 ImageStore.save(imageKey, item.image);
 item.image = 'idb:' + imageKey;
 changed = true;
 }
 });
 if (changed) {
 localStorage.setItem(storeKey, JSON.stringify(items));
 }
 });
}

