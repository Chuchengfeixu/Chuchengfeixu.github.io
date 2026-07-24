

/* ========== 工具函数 ========== */
function ensureUrl(url) {
if (!url) return '';
url = url.trim();
if (!/^https?:\/\//i.test(url)) {
return 'https://' + url;
}
return url;
}

function generateUUID() {
if (crypto && crypto.randomUUID) {
return crypto.randomUUID();
}
return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
var r = Math.random() * 16 | 0;
var v = c === 'x' ? r : (r & 0x3 | 0x8);
return v.toString(16);
});
}

/* ========== ImageStore 模块（IndexedDB 图片存储 + Supabase Storage） ========== */
const ImageStore = {
 DB_NAME: 'sewing_images_db',
 STORE_NAME: 'images',
 BUCKET: 'images',
 db: null,

 init() {
 return new Promise(function(resolve, reject) {
 var request = indexedDB.open(ImageStore.DB_NAME, 1);
 request.onupgradeneeded = function(e) {
 var db = e.target.result;
 if (!db.objectStoreNames.contains(ImageStore.STORE_NAME)) {
 db.createObjectStore(ImageStore.STORE_NAME);
 }
 };
 request.onsuccess = function(e) {
 ImageStore.db = e.target.result;
 resolve();
 };
 request.onerror = function(e) {
 console.error('ImageStore init error:', e);
 resolve();
 };
 });
 },

 save(key, base64Data) {
 var self = this;
 return new Promise(function(resolve, reject) {
 if (!ImageStore.db) { resolve(key); return; }
 var tx = ImageStore.db.transaction(ImageStore.STORE_NAME, 'readwrite');
 var store = tx.objectStore(ImageStore.STORE_NAME);
 store.put(base64Data, key);
 tx.oncomplete = function() { resolve(key); };
 tx.onerror = function(e) { console.error('ImageStore save error:', e); resolve(key); };
 });
 },

 // 上传图片到 Supabase Storage，返回公开 URL
 async saveToCloud(base64Data) {
 try {
 var client = window.supabaseClient;
 if (!client) return null;
 var userId = (window.Auth && Auth.currentUser) ? Auth.currentUser.id : 'anon';
 // 从 base64 转 Blob
 var match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
 if (!match) return null;
 var mime = match[1];
 var ext = mime.split('/')[1] || 'png';
 var binary = atob(match[2]);
 var arr = new Uint8Array(binary.length);
 for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
 var blob = new Blob([arr], { type: mime });
 var fileName = userId + '/' + generateUUID() + '.' + ext;
 var { data, error } = await client.storage.from(this.BUCKET).upload(fileName, blob, { contentType: mime, upsert: false });
 if (error) { console.error('[ImageStore] 上传失败:', error.message); return null; }
 // 获取公开 URL
 var { data: urlData } = client.storage.from(this.BUCKET).getPublicUrl(fileName);
 return urlData ? urlData.publicUrl : null;
 } catch(e) {
 console.error('[ImageStore] saveToCloud error:', e);
 return null;
 }
 },

 get(key) {
 return new Promise(function(resolve, reject) {
 if (!ImageStore.db) { resolve(null); return; }
 var tx = ImageStore.db.transaction(ImageStore.STORE_NAME, 'readonly');
 var store = tx.objectStore(ImageStore.STORE_NAME);
 var request = store.get(key);
 request.onsuccess = function() { resolve(request.result || null); };
 request.onerror = function() { resolve(null); };
 });
 },

 remove(key) {
 return new Promise(function(resolve) {
 if (!ImageStore.db) { resolve(); return; }
 var tx = ImageStore.db.transaction(ImageStore.STORE_NAME, 'readwrite');
 var store = tx.objectStore(ImageStore.STORE_NAME);
 store.delete(key);
 tx.oncomplete = function() { resolve(); };
 tx.onerror = function() { resolve(); };
 });
 },

 getAll() {
 return new Promise(function(resolve) {
 if (!ImageStore.db) { resolve({}); return; }
 var tx = ImageStore.db.transaction(ImageStore.STORE_NAME, 'readonly');
 var store = tx.objectStore(ImageStore.STORE_NAME);
 var result = {};
 var cursor = store.openCursor();
 cursor.onsuccess = function(e) {
 var c = e.target.result;
 if (c) {
 result[c.key] = c.value;
 c.continue();
 } else {
 resolve(result);
 }
 };
 cursor.onerror = function() { resolve(result); };
 });
 }
};
/* 暴露到 window，供 data-layer.js 等外部脚本访问（const 不会自动挂到 window） */
window.ImageStore = ImageStore;

/* ========== 图片加载辅助函数 ========== */
function loadIdbImage(imgElement, imageRef) {
 if (!imageRef) return;
 if (imageRef.startsWith('idb:')) {
 var key = imageRef.substring(4);
 ImageStore.get(key).then(function(data) {
 if (data && imgElement) {
 imgElement.src = data;
 }
 });
 } else {
 imgElement.src = imageRef;
 }
}

/* ========== Store 模块 ========== */
var Store = {
KEYS: {
FABRICS: 'sewing_fabrics',
PRODUCTS: 'sewing_products',
TODOS: 'sewing_todos',
OPTIONS: 'sewing_options',
SCRAPS: 'sewing_scraps',
PATTERNS: 'sewing_patterns',
NOTIONS: 'sewing_notions'
},

getAll(key) {
try {
var data = localStorage.getItem(key);
return data ? JSON.parse(data) : [];
}
catch(e) {
console.error('Store.getAll error:', e);
return [];
}
},

getById(key, id) {
var items = this.getAll(key);
return items.find(function(item) { return item.id === id; }) || null;
},

add(key, record) {
var items = this.getAll(key);
var now = new Date().toISOString();
record.id = generateUUID();
record.createdAt = now;
record.updatedAt = now;
items.push(record);
localStorage.setItem(key, JSON.stringify(items));
/* 添加后检查存储空间 */
setTimeout(function() { if (typeof checkStorageAndWarn === 'function') { checkStorageAndWarn(); } }, 100);
return record;
},

update(key, id, data) {
var items = this.getAll(key);
var index = items.findIndex(function(item) { return item.id === id; });
if (index === -1) {
return null;
}
data.updatedAt = new Date().toISOString();
items[index] = Object.assign({}, items[index], data);
localStorage.setItem(key, JSON.stringify(items));
return items[index];
},

remove(key, id) {
var items = this.getAll(key);
var filtered = items.filter(function(item) { return item.id !== id; });
if (filtered.length === items.length) {
return false;
}
localStorage.setItem(key, JSON.stringify(filtered));
return true;
},

exportAll() {
var self = this;
return ImageStore.getAll().then(function(images) {
var exportData = {
version: '1.1',
exportDate: new Date().toISOString(),
data: {
fabrics: self.getAll(self.KEYS.FABRICS),
products: self.getAll(self.KEYS.PRODUCTS),
todos: self.getAll(self.KEYS.TODOS),
scraps: self.getAll(self.KEYS.SCRAPS),
patterns: self.getAll(self.KEYS.PATTERNS),
notions: self.getAll(self.KEYS.NOTIONS),
options: JSON.parse(localStorage.getItem(self.KEYS.OPTIONS) || '{}')
},
images:images
};
return JSON.stringify(exportData, null, 2);
});
},

importAll(jsonString) {
try {
var imported = JSON.parse(jsonString);
if (!imported.version || !imported.data) {
return Promise.resolve(false);
}
if (imported.data.fabrics) {
localStorage.setItem(this.KEYS.FABRICS, JSON.stringify(imported.data.fabrics));
}
if (imported.data.products) {
localStorage.setItem(this.KEYS.PRODUCTS, JSON.stringify(imported.data.products));
}
if (imported.data.todos) {
localStorage.setItem(this.KEYS.TODOS, JSON.stringify(imported.data.todos));
}
if (imported.data.scraps) {
localStorage.setItem(this.KEYS.SCRAPS, JSON.stringify(imported.data.scraps));
}
if (imported.data.patterns) {
localStorage.setItem(this.KEYS.PATTERNS, JSON.stringify(imported.data.patterns));
}
if (imported.data.notions) {
localStorage.setItem(this.KEYS.NOTIONS, JSON.stringify(imported.data.notions));
}
if (imported.data.options) {
localStorage.setItem(this.KEYS.OPTIONS, JSON.stringify(imported.data.options));
}
if (imported.images) {
 var promises = [];
 for (var key in imported.images) {
 promises.push(ImageStore.save(key, imported.images[key]));
 }
 return Promise.all(promises).then(function() { return true; });
 }
 return Promise.resolve(true);
}
catch(e) {
console.error('Store.importAll error:', e);
return Promise.resolve(false);
}
},

checkStorageQuota() {
try {
var used = 0;
for (var i = 0; i < localStorage.length; i++) {
var key = localStorage.key(i);
var value = localStorage.getItem(key);
used += key.length + value.length;
}
var usedBytes = used * 2;
var totalBytes = 5 * 1024 * 1024;
return {
used: usedBytes,
total: totalBytes,
available: totalBytes - usedBytes
};
}
catch(e) {
console.error('Store.checkStorageQuota error:', e);
return null;
}
}
};

/* ========== Validator 模块 ========== */
const Validator = {
isRequired(value) {
if (value === null || value === undefined) {
return false;
}
return String(value).trim().length > 0;
},

isPositiveNumber(value) {
var num = Number(value);
return !isNaN(num) && num > 0;
},

isValidDate(value) {
if (!value) {
return false;
}
var regex = /^\d{4}-\d{2}-\d{2}$/;
if (!regex.test(value)) {
return false;
}
var date = new Date(value);
return !isNaN(date.getTime());
},

validateFabric(data) {
var errors = {};
if (!this.isRequired(data.name)) {
errors.name = '布料名称不能为空';
}
if (!this.isRequired(data.meters)) {
errors.meters = '所购米数不能为空';
}
else if (!this.isPositiveNumber(data.meters)) {
errors.meters = '所购米数必须为有效正数';
}
if (!this.isRequired(data.price)) {
errors.price = '价格不能为空';
}
else if (!this.isPositiveNumber(data.price)) {
errors.price = '价格必须为有效正数';
}
if (!this.isRequired(data.purchaseDate)) {
errors.purchaseDate = '购买日期不能为空';
}
else if (!this.isValidDate(data.purchaseDate)) {
errors.purchaseDate = '购买日期格式无效';
}
return {
valid: Object.keys(errors).length === 0,
errors: errors
};
},

validateProduct(data) {
var errors = {};
if (!this.isRequired(data.name)) {
errors.name = '制品名称不能为空';
}
if (!this.isRequired(data.completedDate)) {
errors.completedDate = '完成时间不能为空';
}
else if (!this.isValidDate(data.completedDate)) {
errors.completedDate = '完成时间格式无效';
}
return {
valid: Object.keys(errors).length === 0,
errors: errors
};
},

validateTodo(data) {
var errors = {};
if (!this.isRequired(data.name)) {
errors.name = '待做制品名称不能为空';
}
return {
valid: Object.keys(errors).length === 0,
errors: errors
};
}
};

/* ========== Calculator 模块 ========== */
const Calculator = {
 unitPrice(price, meters) {
 if (!meters || meters <= 0) {
 return 0;
 }
 return Math.round(price / meters * 100) / 100;
 },

 remainingMeters(fabricId, purchasedMeters, products, scraps) {
 var used = 0;
 products.forEach(function(product) {
 if (product.fabricUsages && Array.isArray(product.fabricUsages)) {
 product.fabricUsages.forEach(function(usage) {
 if (usage.fabricId === fabricId) {
 used += Number(usage.metersUsed) || 0;
 }
 });
 }
 });
 if (scraps) {
 scraps.forEach(function(s) {
 if (s.fabricId === fabricId) {
 used += Number(s.meters) || 0;
 }
 });
 }
 return Math.round((purchasedMeters - used) * 100) / 100;
 },

 fabricStats(fabrics, products) {
 var total = fabrics.length;
 var totalSpent = 0;
 var shopMap = {};
 fabrics.forEach(function(f) {
 var price = Number(f.price) || 0;
 totalSpent += price;
 var shop = f.shop || '未知店铺';
 if (!shopMap[shop]) {
 shopMap[shop] = 0;
 }
 shopMap[shop] += price;
 });
 totalSpent = Math.round(totalSpent * 100) / 100;
 var shopDistribution = [];
 for (var shop in shopMap) {
 shopDistribution.push({ shop: shop, amount: Math.round(shopMap[shop] * 100) / 100 });
 }
 shopDistribution.sort(function(a, b) { return b.amount - a.amount; });
 return { total: total, totalSpent: totalSpent, shopDistribution: shopDistribution };
 },

 patternStats(products) {
 var sourceMap = {};
 products.forEach(function(p) {
 var source = p.patternSource || '未指定';
 if (!sourceMap[source]) {
 sourceMap[source] = 0;
 }
 sourceMap[source]++;
 });
 var result = [];
 for (var source in sourceMap) {
 result.push({ source: source, count: sourceMap[source] });
 }
 result.sort(function(a, b) { return b.count - a.count; });
 return result;
 },

 productCategoryStats(products) {
 var catMap = {};
 products.forEach(function(p) {
 var category = p.category || '未分类';
 if (!catMap[category]) {
 catMap[category] = 0;
 }
 catMap[category]++;
 });
 var result = [];
 for (var cat in catMap) {
 result.push({ category: cat, count: catMap[cat] });
 }
 result.sort(function(a, b) { return b.count - a.count; });
 return result;
 },

 productUserStats(products) {
 var userMap = {};
 products.forEach(function(p) {
 var user = p.user || '未指定';
 if (!userMap[user]) {
 userMap[user] = 0;
 }
 userMap[user]++;
 });
 var result = [];
 for (var user in userMap) {
 result.push({ user: user, count: userMap[user] });
 }
 result.sort(function(a, b) { return b.count - a.count; });
 return result;
 },

 monthlyTrend(fabrics, products) {
 var monthMap = {};
 fabrics.forEach(function(f) {
 if (f.purchaseDate) {
 var month = f.purchaseDate.substring(0, 7);
 if (!monthMap[month]) {
 monthMap[month] = { month: month, fabricCount: 0, productCount: 0, purchaseAmount: 0 };
 }
 monthMap[month].fabricCount++;
 var price = parseFloat(f.price) || 0;
 monthMap[month].purchaseAmount += price;
 }
 });
 products.forEach(function(p) {
 if (p.completedDate) {
 var month = p.completedDate.substring(0, 7);
 if (!monthMap[month]) {
 monthMap[month] = { month: month, fabricCount: 0, productCount: 0, purchaseAmount: 0  };
 }
 monthMap[month].productCount++;
 }
 });
 var result = [];
 for (var m in monthMap) {
 result.push(monthMap[m]);
 }
 result.sort(function(a, b) { return a.month.localeCompare(b.month); });
 return result;
 },

 availableFabrics(fabrics, products, scraps) {
 var self = this;
 return fabrics.filter(function(f) {
 var remaining = self.remainingMeters(f.id, f.meters, products, scraps);
 return remaining > 0;
 }).map(function(f) {
 return {
 id: f.id,
 name: f.name,
 shop: f.shop || '',
 meters: f.meters,
 remainingMeters: self.remainingMeters(f.id, f.meters, products, scraps)
 };
 });
 }
};

/* ========== OptionController 模块 ========== */
const OptionController = {
 FIELD_DEFAULTS: {
 fabricWidth: ['90cm', '110cm', '140cm', '150cm', '160cm'],
 fabricShop: [],
 productCategory: ['衣服', '收纳', '食品', '玩具', '包包'],
 productUser: [],
 patternSource: ['自制无版', '自制打板'],
 patternCategory: ['上衣', '连衣裙', '裤子', '裙子', '外套', '包包', '配饰'],
 patternBrand: [],
 notionCategory: ['拉链', '纽扣', '线', '松紧带', '魔术贴', '织带', '花边', '其它'],
 notionUnit: ['个', '条', '卷', '米', '包', '套'],
 notionShop: []
 },

 _ensureInitialized() {
 var stored = localStorage.getItem(Store.KEYS.OPTIONS);
 if (!stored) {
 localStorage.setItem(Store.KEYS.OPTIONS, JSON.stringify(this.FIELD_DEFAULTS));
 }
 },

 getOptions(fieldName) {
 this._ensureInitialized();
 var options = JSON.parse(localStorage.getItem(Store.KEYS.OPTIONS) || '{}');
 return options[fieldName] || [];
 },

 addOption(fieldName, value) {
 this._ensureInitialized();
 var options = JSON.parse(localStorage.getItem(Store.KEYS.OPTIONS) || '{}');
 if (!options[fieldName]) {
 options[fieldName] = [];
 }
 var trimmed = String(value).trim();
 if (trimmed && options[fieldName].indexOf(trimmed) === -1) {
 options[fieldName].push(trimmed);
 localStorage.setItem(Store.KEYS.OPTIONS, JSON.stringify(options));
 }
 return options[fieldName];
 },

 updateOption(fieldName, oldValue, newValue) {
 this._ensureInitialized();
 var options = JSON.parse(localStorage.getItem(Store.KEYS.OPTIONS) || '{}');
 if (!options[fieldName]) { return options[fieldName] || []; }
 var trimmedNew = String(newValue).trim();
 if (!trimmedNew) { return options[fieldName]; }
 var index = options[fieldName].indexOf(oldValue);
 if (index === -1) { return options[fieldName]; }
 if (trimmedNew !== oldValue && options[fieldName].indexOf(trimmedNew) !== -1) {
 return options[fieldName];
 }
 options[fieldName][index] = trimmedNew;
 localStorage.setItem(Store.KEYS.OPTIONS, JSON.stringify(options));
 return options[fieldName];
 },

 removeOption(fieldName, value) {
 this._ensureInitialized();
 var options = JSON.parse(localStorage.getItem(Store.KEYS.OPTIONS) || '{}');
 if (!options[fieldName]) { return []; }
 options[fieldName] = options[fieldName].filter(function(v) { return v !== value; });
 localStorage.setItem(Store.KEYS.OPTIONS, JSON.stringify(options));
 return options[fieldName];
 },
 
 moveOption(fieldName, value, direction) {
 this._ensureInitialized();
 var options = JSON.parse(localStorage.getItem(Store.KEYS.OPTIONS) || '{}');
 if (!options[fieldName]) { return []; }
 var idx = options[fieldName].indexOf(value);
 if (idx === -1) { return options[fieldName]; }
 var targetIdx = (direction === 'up') ? idx - 1 : idx + 1;
 if (targetIdx < 0 || targetIdx >= options[fieldName].length) { return options[fieldName]; }
 var temp = options[fieldName][idx];
 options[fieldName][idx] = options[fieldName][targetIdx];
 options[fieldName][targetIdx] = temp;
 localStorage.setItem(Store.KEYS.OPTIONS, JSON.stringify(options));
 return options[fieldName];
 }
};

/* ========== Toast 提示组件 ========== */
const Toast = {
 show(message, type) {
 type = type || 'success';
 var container = document.getElementById('toastContainer');
 var toast = document.createElement('div');
 toast.className = 'toast toast-' + type;
 toast.textContent = message;
 container.appendChild(toast);
 setTimeout(function() {
 if (toast.parentNode) {
 toast.parentNode.removeChild(toast);
 }
 }, 3000);
 }
};

/* ========== Paywall 升级引导组件（community-and-monetization 任务9） ========== */
const Paywall = {
 // 集中管理各付费点文案（需求 11.3）
 FEATURES: {
 'image-quota': { icon: '🖼️', title: '本月图片额度已用完', desc: '免费版每月可新增 20 张图片。升级 Pro 解锁无限上传。' },
 'analytics':   { icon: '📈', title: '数据分析是 Pro 功能', desc: '解锁布料消耗趋势、成本核算、库存周转等深度分析。' }
 },

 show(featureKey) {
 var f = this.FEATURES[featureKey] || { icon: '⭐', title: '升级 Pro 解锁', desc: '该功能为 Pro 专属。' };
 // 移除旧的
 var old = document.getElementById('paywallOverlay');
 if (old) old.parentNode.removeChild(old);

 var overlay = document.createElement('div');
 overlay.id = 'paywallOverlay';
 overlay.style.cssText = 'position:fixed;inset:0;background:rgba(30,30,30,0.35);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:9998;display:flex;justify-content:center;align-items:center;padding:20px;';

 var box = document.createElement('div');
 box.style.cssText = 'background:#fff;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,0.18);padding:32px 28px;max-width:380px;width:100%;text-align:center;border:1px solid var(--border);animation:formSlideIn 0.3s ease;';
 box.innerHTML =
 '<div style="font-size:44px;margin-bottom:12px;">' + f.icon + '</div>' +
 '<div style="font-size:18px;font-weight:700;color:var(--purple-dark);margin-bottom:8px;">' + f.title + '</div>' +
 '<div style="font-size:13.5px;color:var(--text-light);line-height:1.7;margin-bottom:22px;">' + f.desc + '</div>' +
 '<button id="paywallUpgrade" class="btn btn-purple" style="width:100%;margin-bottom:10px;">了解 Pro ⭐</button>' +
 '<button id="paywallClose" class="btn btn-gray" style="width:100%;">暂不需要</button>';
 overlay.appendChild(box);
 document.body.appendChild(overlay);

 function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
 overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
 document.getElementById('paywallClose').addEventListener('click', close);
 document.getElementById('paywallUpgrade').addEventListener('click', function() {
 close();
 // TODO: 接入实际升级/充值流程（后续批次）；当前先提示
 if (window.Toast) Toast.show('Pro 升级通道即将开放 🙌', 'success');
 });
 }
};

/* ========== 图片上传配额守卫（community-and-monetization 任务10） ==========
 用法：把用户上传图片的处理逻辑放进 onAllowed 回调。
 会先调后端 RPC 原子校验并计数：允许则执行 onAllowed；免费超额弹 Paywall；网络异常提示重试。
 导入/迁移等系统写图不走此守卫，不占配额。 */
function guardImageUpload(onAllowed) {
 if (!window.QuotaService) { onAllowed(); return; }
 QuotaService.checkAndIncrement().then(function(r) {
 if (r && r.allowed) {
 onAllowed();
 } else if (r && r.reason === 'quota_exceeded') {
 if (window.Paywall) Paywall.show('image-quota');
 } else {
 if (window.Toast) Toast.show('无法校验图片额度，请稍后重试', 'error');
 }
 });
}

/* ========== Router 模块 ========== */
const Router = {
 pages: ['home', 'fabric', 'product', 'pattern', 'notion', 'todo', 'dashboard', 'print', 'community'],
 defaultPage: 'home',
 _onNavigateCallbacks: [],

 init() {
 var self = this;
 window.addEventListener('hashchange', function() {
 self._handleRoute();
 });
 this._handleRoute();
 },

 _handleRoute() {
 var page = this.getCurrentPage();
 this.pages.forEach(function(p) {
 var el = document.getElementById('page-' + p);
 if (el) {
 el.classList.toggle('active', p === page);
 }
 });
 var navLinks = document.querySelectorAll('.sidebar-nav a[data-page]');
 navLinks.forEach(function(link) {
 link.classList.toggle('active', link.getAttribute('data-page') === page);
 });
 this._onNavigateCallbacks.forEach(function(cb) {
 cb(page);
 });
 },

 navigate(hash) {
 window.location.hash = '#' + hash;
 },

 getCurrentPage() {
 var hash = window.location.hash.replace('#', '');
 if (this.pages.indexOf(hash) !== -1) {
 return hash;
 }
 return this.defaultPage;
 },

 onNavigate(callback) {
 this._onNavigateCallbacks.push(callback);
 }
};

/* ========== ViewToggle 模块 ========== */
const ViewToggle = {
 modes: {},

 getMode(page) {
 return this.modes[page] || 'card';
 },

 setMode(page, mode) {
 this.modes[page] = mode;
 }
};

/* ========== CardExpandState 模块 ========== */
const CardExpandState = {
 STORAGE_KEY: 'sewing_card_expand_state',

 getState(page) {
 var stored = localStorage.getItem(this.STORAGE_KEY);
 if (!stored) { return false; }
 var states = JSON.parse(stored);
 return !!states[page];
 },

 setState(page, expanded) {
 var stored = localStorage.getItem(this.STORAGE_KEY);
 var states = stored ? JSON.parse(stored) : {};
 states[page] = expanded;
 localStorage.setItem(this.STORAGE_KEY, JSON.stringify(states));
 },

 applyAll(page, expanded) {
 this.setState(page, expanded);
 var containerMap = { fabric: 'fabricList', product: 'productList', todo: 'todoList', pattern: 'patternList', notion: 'notionList' };
 var container = document.getElementById(containerMap[page]);
 if (!container) { return; }
 var details = container.querySelectorAll('.card-details');
 var toggles = container.querySelectorAll('.card-expand-toggle');
 details.forEach(function(d) {
 d.style.display = expanded ? 'block' : 'none';
 });
 toggles.forEach(function(t) {
 t.textContent = expanded ? '收起 ▴' : '展开 ▾';
 });
 this.updateBtnState(page, expanded);
 },

 updateBtnState(page, expanded) {
 var btnMap = {
 fabric: ['btnFabricExpandAll', 'btnFabricCollapseAll'],
 product: ['btnProductExpandAll', 'btnProductCollapseAll'],
 todo: ['btnTodoExpandAll', 'btnTodoCollapseAll'],
 pattern: ['btnPatternExpandAll', 'btnPatternCollapseAll'],
 notion: ['btnNotionExpandAll', 'btnNotionCollapseAll']
 };
 var ids = btnMap[page];
 if (!ids) { return; }
 var expandBtn = document.getElementById(ids[0]);
 var collapseBtn = document.getElementById(ids[1]);
 if (expandBtn) { expandBtn.classList.toggle('active', expanded); }
 if (collapseBtn) { collapseBtn.classList.toggle('active', !expanded); }
 },

 init() {
 var self = this;
 var pages = ['fabric', 'product', 'todo', 'pattern', 'notion'];
 pages.forEach(function(page) {
 var state = self.getState(page);
 self.updateBtnState(page, state);
 });

 document.getElementById('btnFabricExpandAll').addEventListener('click', function() { self.applyAll('fabric', true); });
 document.getElementById('btnFabricCollapseAll').addEventListener('click', function() { self.applyAll('fabric', false); });
 document.getElementById('btnProductExpandAll').addEventListener('click', function() { self.applyAll('product', true); });
 document.getElementById('btnProductCollapseAll').addEventListener('click', function() { self.applyAll('product', false); });
 document.getElementById('btnTodoExpandAll').addEventListener('click', function() { self.applyAll('todo', true); });
 document.getElementById('btnTodoCollapseAll').addEventListener('click', function() { self.applyAll('todo', false); });
 document.getElementById('btnPatternExpandAll').addEventListener('click', function() { self.applyAll('pattern', true); });
 document.getElementById('btnPatternCollapseAll').addEventListener('click', function() { self.applyAll('pattern', false); });
 document.getElementById('btnNotionExpandAll').addEventListener('click', function() { self.applyAll('notion', true); });
 document.getElementById('btnNotionCollapseAll').addEventListener('click', function() { self.applyAll('notion', false); });
 }
};

/* ========== FabricController 模块 ========== */
const FabricController = {
 editingId: null,
 imageBase64: '',
 imageKey: '',
 qualityRating: 0,

 init() {
 var self = this;
 document.getElementById('btnAddFabric').addEventListener('click', function() {
 self.openForm();
 });
 document.getElementById('btnCancelFabric').addEventListener('click', function() {
 self.closeForm();
 });
 document.getElementById('btnSaveCopyFabric').addEventListener('click', function() {
 self.handleSubmit(true);
 });
 document.getElementById('fabricForm').addEventListener('submit', function(e) {
 e.preventDefault();
 self.handleSubmit(false);
 });
 document.getElementById('fabricFormOverlay').addEventListener('click', function(e) {
 /*点击外部不关闭*/
 });

 var priceInput = document.getElementById('fabricPrice');
 var metersInput = document.getElementById('fabricMeters');
 priceInput.addEventListener('input', function() { self.updateUnitPrice(); });
 metersInput.addEventListener('input', function() { self.updateUnitPrice(); });

 document.getElementById('fabricImageInput').addEventListener('change', function(e) {
 self.handleImageUpload(e);
 });
 document.getElementById('fabricImageRemove').addEventListener('click', function() {
 self.removeImage();
 });

 /* Ctrl+V 粘贴图片 */
 document.getElementById('fabricForm').addEventListener('paste', function(e) {
 var items = (e.clipboardData || e.originalEvent.clipboardData).items;
 for (var i = 0; i < items.length; i++) {
 if (items[i].type.indexOf('image') !== -1) {
 e.preventDefault();
 var blob = items[i].getAsFile();
 var reader = new FileReader();
 reader.onload = function(ev) {
 guardImageUpload(function() {
 FabricController.imageBase64 = ev.target.result;
 var imageKey = 'img_' + generateUUID();
 ImageStore.save(imageKey, ev.target.result);
 FabricController.imageKey = 'idb:' + imageKey;
 document.getElementById('fabricImageThumb').src = ev.target.result;
 document.getElementById('fabricImagePreview').style.display = 'block';
 document.getElementById('fabricImageArea').querySelector('.upload-hint').textContent = '已粘贴图片，点击更换';
 FabricController.performOCR(ev.target.result);
 });
 };
 reader.readAsDataURL(blob);
 break;
 }
 }
 });

 /* 视图切换 */
 document.getElementById('fabricViewToggle').addEventListener('click', function(e) {
 var btn = e.target.closest('.view-toggle-btn');
 if (!btn) return;
 var mode = btn.getAttribute('data-mode');
 ViewToggle.setMode('fabric', mode);
 document.querySelectorAll('#fabricViewToggle .view-toggle-btn').forEach(function(b) {
 b.classList.toggle('active', b.getAttribute('data-mode') === mode);
 });
 document.getElementById('fabricExpandBtns').style.display = (mode === 'card') ? '' : 'none';
 self.renderList();
 });

/* 显示已用完布料开关 */
 var depletedCheckbox = document.getElementById('showDepletedFabrics');
 var savedDepleted = localStorage.getItem('sewing_show_depleted');
 depletedCheckbox.checked = savedDepleted === 'true';
 depletedCheckbox.addEventListener('change', function() {
 localStorage.setItem('sewing_show_depleted', this.checked ? 'true' : 'false');
 self.renderList();
 });
 
 /* 报废按钮 */
 document.getElementById('btnScrapFabric').addEventListener('click', function() {
 self.scrapFabric();
 });

 this.initStarRating();
 this.renderList();

 Router.onNavigate(function(page) {
 if (page === 'fabric') {
 PageFilter._rendered_fabric = false;
 self.renderList();
 }
 });
 },

 initStarRating() {
 var self = this;
 var stars = document.querySelectorAll('#fabricQuality .star');
 stars.forEach(function(star) {
 star.addEventListener('click', function() {
 var val = parseInt(this.getAttribute('data-value'));
 if (self.qualityRating === val) {
 self.qualityRating = 0;
 } else {
 self.qualityRating = val;
 }
 self.renderStars();
 });
 star.addEventListener('mouseenter', function() {
 var val = parseInt(this.getAttribute('data-value'));
 self.highlightStars(val);
 });
 star.addEventListener('mouseleave', function() {
 self.renderStars();
 });
 });
 },

 highlightStars(count) {
 var stars = document.querySelectorAll('#fabricQuality .star');
 stars.forEach(function(star) {
 var val = parseInt(star.getAttribute('data-value'));
 star.classList.toggle('active', val <= count);
 });
 },

 renderStars() {
 var self = this;
 var stars = document.querySelectorAll('#fabricQuality .star');
 stars.forEach(function(star) {
 var val = parseInt(star.getAttribute('data-value'));
 star.classList.toggle('active', val <= self.qualityRating);
 });
 },

 populateShopOptions(selectedValue) {
 var select = document.getElementById('fabricShop');
 var options = OptionController.getOptions('fabricShop');
 select.innerHTML = '<option value="">请选择店铺</option>';
 options.forEach(function(opt) {
 var o = document.createElement('option');
 o.value = opt;
 o.textContent = opt;
 if (opt === selectedValue) { o.selected = true; }
 select.appendChild(o);
 });
 var addOpt = document.createElement('option');
 addOpt.value = '__add_new__';
 addOpt.textContent = '+ 新增选项...';
 select.appendChild(addOpt);

 select.onchange = function() {
 if (select.value === '__add_new__') {
 var newVal = prompt('请输入新的店铺名称：');
 if (newVal && newVal.trim()) {
 OptionController.addOption('fabricShop', newVal.trim());
 FabricController.populateShopOptions(newVal.trim());
 } else {
 select.value = selectedValue || '';
 }
 }
 };
 },

 populateWidthOptions(selectedValue) {
 var select = document.getElementById('fabricWidth');
 var options = OptionController.getOptions('fabricWidth');
 select.innerHTML = '<option value="">请选择幅宽</option>';
 options.forEach(function(opt) {
 var o = document.createElement('option');
 o.value = opt;
 o.textContent = opt;
 if (opt === selectedValue) { o.selected = true; }
 select.appendChild(o);
 });
 var addOpt = document.createElement('option');
 addOpt.value = '__add_new__';
 addOpt.textContent = '+ 新增选项...';
 select.appendChild(addOpt);

 select.onchange = function() {
 if (select.value === '__add_new__') {
 var newVal = prompt('请输入新的幅宽值（如 120cm）：');
 if (newVal && newVal.trim()) {
 OptionController.addOption('fabricWidth', newVal.trim());
 FabricController.populateWidthOptions(newVal.trim());
 } else {
 select.value = selectedValue || '';
 }
 }
 };
 },

 updateUnitPrice() {
 var price = parseFloat(document.getElementById('fabricPrice').value);
 var meters = parseFloat(document.getElementById('fabricMeters').value);
 var display = document.getElementById('fabricUnitPrice');
 if (price > 0 && meters > 0) {
 var up = Calculator.unitPrice(price, meters);
 display.textContent = '单价：¥' + up.toFixed(2) + ' /米';
 } else {
 display.textContent = '单价：--';
 }
 },

 handleImageUpload(e) {
 var self = this;
 var file = e.target.files[0];
 if (!file) { return; }
 if (!file.type.startsWith('image/')) {
 Toast.show('请选择图片文件', 'error');
 return;
 }
 var reader = new FileReader();
 reader.onload = function(ev) {
 guardImageUpload(function() {
 self.imageBase64 = ev.target.result;
 var imageKey = 'img_' + generateUUID();
 ImageStore.save(imageKey, ev.target.result);
 self.imageKey = 'idb:' + imageKey;
 document.getElementById('fabricImageThumb').src = self.imageBase64;
 document.getElementById('fabricImagePreview').style.display = 'block';
 document.getElementById('fabricImageArea').querySelector('.upload-hint').textContent = '已选择图片，点击更换';
 self.performOCR(self.imageBase64);
 });
 };
 reader.readAsDataURL(file);
 },

 performOCR(imageData) {
 var self = this;
 var statusEl = document.getElementById('fabricOcrStatus');
 var spinnerEl = document.getElementById('fabricOcrSpinner');
 var textEl = document.getElementById('fabricOcrText');

 if (typeof Tesseract === 'undefined') {
 return;
 }

 statusEl.className = 'ocr-status show loading';
 spinnerEl.style.display = '';
 textEl.textContent = '正在识别图片文字...';

Tesseract.recognize(imageData, 'chi_sim+eng', {
 logger: function() {}
 }).then(function(result) {
 var text = result.data.text || '';
 if (!text.trim()) {
 statusEl.className = 'ocr-status show error';
 spinnerEl.style.display = 'none';
 textEl.textContent = '未能识别图片中的文字';
 Toast.show('未能识别图片中的文字', 'warning');
 setTimeout(function() { statusEl.className = 'ocr-status'; }, 3000);
 return;
 }
 self.parseOCRText(text);
 statusEl.className = 'ocr-status show done';
 spinnerEl.style.display = 'none';
 textEl.textContent = '图片文字识别完成';
 Toast.show('图片文字识别完成', 'success');
 setTimeout(function() { statusEl.className = 'ocr-status'; }, 3000);
 }).catch(function(err) {
 console.error('OCR error:', err);
 statusEl.className = 'ocr-status show error';
 spinnerEl.style.display = 'none';
 textEl.textContent = '未能识别图片中的文字';
 Toast.show('未能识别图片中的文字', 'warning');
 setTimeout(function() { statusEl.className = 'ocr-status'; }, 3000);
 });
 },

 parseOCRText(text) {
 var lines = text.replace(/\r\n/g, '\n').split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
 var fullText = lines.join(' ');

 var metersVal = null;
 var priceVal = null;
 var widthVal = null;
 var dateVal = null;
 var nameCandidate = [];

 for (var i = 0; i < lines.length; i++) {
 var line = lines[i];

 if (!dateVal) {
 var dateMatch = line.match(/(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})/);
 if (dateMatch) {
 var mm = dateMatch[2].padStart(2, '0');
 var dd = dateMatch[3].padStart(2, '0');
 dateVal = dateMatch[1] + '-' + mm + '-' + dd;
 continue;
 }
 }

 if (!priceVal) {
 var priceMatch = line.match(/[¥￥][\s]*(\d+\.?\d*)/);
 if (!priceMatch) { priceMatch = line.match(/(\d+\.?\d*)[\s]*元/); }
 if (!priceMatch) { priceMatch = line.match(/价格[\s:：]*(\d+\.?\d*)/); }
 if (!priceMatch) { priceMatch = line.match(/单价[\s:：]*(\d+\.?\d*)/); }
 if (priceMatch) {
 priceVal = parseFloat(priceMatch[1]);
 continue;
 }
 }

 if (!widthVal) {
 var widthMatch = line.match(/幅宽[\s:：]*(\d+)/i);
 if (!widthMatch) { widthMatch = line.match(/(\d{2,3})[\s]*[cCＣ][mMＭ]/); }
 if (widthMatch) {
 widthVal = widthMatch[1] + 'cm';
 continue;
 }
 }

 if (!metersVal) {
 var metersMatch = line.match(/(\d+\.?\d*)[\s]*[米mMＭ]/);
 if (!metersMatch) { metersMatch = line.match(/米数[\s:：]*(\d+\.?\d*)/); }
 if (metersMatch) {
 metersVal = parseFloat(metersMatch[1]);
 continue;
 }
 }

 nameCandidate.push(line);
 }

 if (!metersVal && !priceVal && !widthVal && !dateVal) {
 var numMatch = fullText.match(/(\d+\.?\d+)/);
 if (numMatch) {
 metersVal = parseFloat(numMatch[1]);
 }
 }

 var nameInput = document.getElementById('fabricName');
 var metersInput = document.getElementById('fabricMeters');
 var priceInput = document.getElementById('fabricPrice');
 var dateInput = document.getElementById('fabricPurchaseDate');

 if (metersVal && !metersInput.value) {
 metersInput.value = metersVal;
 }
 if (priceVal && !priceInput.value) {
 priceInput.value = priceVal;
 }
 if (dateVal && !dateInput.value) {
 dateInput.value = dateVal;
 }
 if (widthVal) {
 var widthSelect = document.getElementById('fabricWidth');
 if (!widthSelect.value) {
 var found = false;
 for (var j = 0; j < widthSelect.options.length; j++) {
 if (widthSelect.options[j].value === widthVal) {
 widthSelect.value = widthVal;
 found = true;
 break;
 }
 }
 if (!found) {
 OptionController.addOption('fabricWidth', widthVal);
 this.populateWidthOptions(widthVal);
 }
 }
 }
 if (nameCandidate.length > 0 && !nameInput.value) {
 var candidateName = nameCandidate[0].replace(/[\d¥￥元米价格单幅宽:：\s]/g, '').trim();
 if (candidateName.length > 0 && candidateName.length <= 30) {
 nameInput.value = candidateName;
 }
 }

 this.updateUnitPrice();
 },

 removeImage() {
 this.imageBase64 = '';
 this.imageKey = '';
 document.getElementById('fabricImageThumb').src = '';
 document.getElementById('fabricImagePreview').style.display = 'none';
 document.getElementById('fabricImageInput').value = '';
 document.getElementById('fabricImageArea').querySelector('.upload-hint').textContent = '点击上传或 Ctrl+V 粘贴';
 document.getElementById('fabricOcrStatus').className = 'ocr-status';
 },

 openForm(fabricId) {
 var self = this;
 this.editingId = fabricId || null;
 this.clearFormErrors();
 this.populateShopOptions('');
 this.populateWidthOptions('');

 if (fabricId) {
 var fabric = Store.getById(Store.KEYS.FABRICS, fabricId);
 if (!fabric) { return; }
 document.getElementById('fabricFormTitle').textContent = '编辑布料';
 document.getElementById('fabricEditId').value = fabricId;
 document.getElementById('fabricName').value = fabric.name || '';
 this.populateShopOptions(fabric.shop || '');
 document.getElementById('fabricCode').value = fabric.code || '';
 document.getElementById('fabricMeters').value = fabric.meters || '';
 this.populateWidthOptions(fabric.width || '');
 document.getElementById('fabricWeight').value = fabric.weight || '';
 document.getElementById('fabricPrice').value = fabric.price || '';
 document.getElementById('fabricPurchaseDate').value = fabric.purchaseDate || '';
 this.qualityRating = fabric.quality || 0;
 this.renderStars();
 if (fabric.image) {
 if (fabric.image.startsWith('idb:')) {
 self.imageKey = fabric.image;
 ImageStore.get(fabric.image.substring(4)).then(function(data) {
 if (data) {
 self.imageBase64 = data;
 document.getElementById('fabricImageThumb').src = data;
 document.getElementById('fabricImagePreview').style.display = 'block';
 }
 });
 } else {
 self.imageBase64 = fabric.image;
 self.imageKey = '';
 document.getElementById('fabricImageThumb').src = fabric.image;
 document.getElementById('fabricImagePreview').style.display = 'block';
 }
 } else {
 this.removeImage();
 }
 this.updateUnitPrice();
 /* 显示剩余米数 */
 var products = Store.getAll(Store.KEYS.PRODUCTS);
 var scraps = Store.getAll(Store.KEYS.SCRAPS);
 var remaining = Calculator.remainingMeters(fabricId, fabric.meters, products, scraps);
 var remainingDisplay = document.getElementById('fabricRemainingDisplay');
 var remainingText = document.getElementById('fabricRemainingText');
 remainingDisplay.style.display = '';
 remainingText.textContent = '剩余：' + remaining + ' 米';
 remainingDisplay.style.background = remaining < 0.5 ? '#FEF2F2' : '#ECFDF5';
 remainingText.style.color = remaining < 0.5 ? 'var(--coral)' : 'var(--green-dark)';
 } else {
 document.getElementById('fabricFormTitle').textContent = '添加布料';
 document.getElementById('fabricEditId').value = '';
 document.getElementById('fabricForm').reset();
 document.getElementById('fabricPurchaseDate').value = new Date().toISOString().split('T')[0];
 this.qualityRating = 0;
 this.renderStars();
 this.removeImage();
 this.updateUnitPrice();
 document.getElementById('fabricRemainingDisplay').style.display = 'none';
 }

 document.getElementById('fabricFormOverlay').classList.add('show');
 },

 closeForm() {
 document.getElementById('fabricFormOverlay').classList.remove('show');
 this.editingId = null;
 },

 clearFormErrors() {
 var groups = document.querySelectorAll('#fabricForm .form-group');
 groups.forEach(function(g) { g.classList.remove('has-error'); });
 },

 showFormErrors(errors) {
 this.clearFormErrors();
 var fieldMap = {
 name: 'fabricNameError',
 meters: 'fabricMetersError',
 price: 'fabricPriceError',
 purchaseDate: 'fabricPurchaseDateError'
 };
 for (var field in errors) {
 var errEl = document.getElementById(fieldMap[field]);
 if (errEl) {
 errEl.textContent = errors[field];
 errEl.parentElement.classList.add('has-error');
 }
 }
 },

 handleSubmit(copyAfter) {
 var data = {
 name: document.getElementById('fabricName').value.trim(),
 shop: document.getElementById('fabricShop').value === '__add_new__' ? '' : document.getElementById('fabricShop').value,
 code: document.getElementById('fabricCode').value.trim(),
 meters: parseFloat(document.getElementById('fabricMeters').value) || '',
 width: document.getElementById('fabricWidth').value === '__add_new__' ? '' : document.getElementById('fabricWidth').value,
 weight: document.getElementById('fabricWeight').value.trim(),
 price: parseFloat(document.getElementById('fabricPrice').value) || '',
 purchaseDate: document.getElementById('fabricPurchaseDate').value,
 image: this.imageKey || this.imageBase64,
 quality: this.qualityRating || null
 };

 var result = Validator.validateFabric(data);
 if (!result.valid) {
 this.showFormErrors(result.errors);
 Toast.show('请检查表单填写', 'error');
 return;
 }

 if (this.editingId) {
 Store.update(Store.KEYS.FABRICS, this.editingId, data);
 Toast.show('布料更新成功', 'success');
 } else {
 Store.add(Store.KEYS.FABRICS, data);
 Toast.show('布料添加成功', 'success');
 }

 this.closeForm();
 this.renderList();

 if (copyAfter) {
 var self = this;
 setTimeout(function() {
 self.openForm();
 document.getElementById('fabricName').value = data.name;
 self.populateShopOptions(data.shop);
 document.getElementById('fabricCode').value = data.code;
 document.getElementById('fabricMeters').value = data.meters;
 self.populateWidthOptions(data.width);
 document.getElementById('fabricWeight').value = data.weight;
 document.getElementById('fabricPrice').value = data.price;
 document.getElementById('fabricPurchaseDate').value = data.purchaseDate;
 self.qualityRating = data.quality || 0;
 self.renderStars();
 if (data.image) {
 self.imageKey = data.image;
 if (data.image.startsWith('idb:')) {
 ImageStore.get(data.image.substring(4)).then(function(imgData) {
 if (imgData) {
 self.imageBase64 = imgData;
 document.getElementById('fabricImageThumb').src = imgData;
 document.getElementById('fabricImagePreview').style.display = 'block';
 }
 });
 }
 }
 self.updateUnitPrice();
 }, 100);
 }
 },

 deleteFabric(id) {
 DeleteConfirm.show('确定要删除这条布料记录吗？此操作不可撤销。', function() {
 Store.remove(Store.KEYS.FABRICS, id);
 Toast.show('布料已删除', 'success');
 FabricController.renderList();
 });
 },

 addMeters(id) {
 var fabric = Store.getById(Store.KEYS.FABRICS, id);
 if (!fabric) return;
 var input = prompt('追加米数（累加到「' + fabric.name + '」的总米数，当前 ' + (fabric.meters || 0) + ' 米）', '');
 if (input === null) return;
 var add = Number(input);
 if (!isFinite(add) || add <= 0) { Toast.show('请输入大于 0 的数字', 'error'); return; }
 var newMeters = Math.round((Number(fabric.meters || 0) + add) * 100) / 100;
 Store.update(Store.KEYS.FABRICS, id, { meters: newMeters });
 Toast.show('已追加 ' + add + ' 米，总米数 ' + newMeters, 'success');
 FabricController.renderList();
 },

 scrapFabric() {
 if (!this.editingId) return;
 var fabric = Store.getById(Store.KEYS.FABRICS, this.editingId);
 if (!fabric) return;
 var products = Store.getAll(Store.KEYS.PRODUCTS);
 var scraps = Store.getAll(Store.KEYS.SCRAPS);
 var remaining = Calculator.remainingMeters(this.editingId, fabric.meters, products, scraps);
 if (remaining <= 0) {
 Toast.show('该布料已无剩余米数', 'warning');
 return;
 }
 DeleteConfirm.show('确定要报废剩余的 ' + remaining + ' 米布料吗？', function() {
 Store.add(Store.KEYS.SCRAPS, {
 fabricId: fabric.id,
 fabricName: fabric.name,
 meters: remaining,
 date: new Date().toISOString().split('T')[0],
 reason: '报废'
 });
 Toast.show('已报废 ' + remaining + ' 米', 'success');
 document.getElementById('fabricRemainingText').textContent = '剩余：0 米';
 document.getElementById('fabricRemainingDisplay').style.background = '#FEF2F2';
 document.getElementById('fabricRemainingText').style.color = 'var(--coral)';
 FabricController.renderList();
 });
 },

 renderStarDisplay(quality) {
 var html = '';
 for (var i = 1; i <= 5; i++) {
 html += '<span style="color:' + (i <= quality ? 'var(--yellow)' : 'var(--border)') + '">★</span>';
 }
 return html;
 },

 renderList() {
 var self = this;
 var fabrics = Store.getAll(Store.KEYS.FABRICS);
 var products = Store.getAll(Store.KEYS.PRODUCTS);
 var scraps = Store.getAll(Store.KEYS.SCRAPS);
 var container = document.getElementById('fabricList');
 var mode = ViewToggle.getMode('fabric');

 /* 按购买日期倒序 */
 fabrics.sort(function(a, b) {
 return (b.purchaseDate || '').localeCompare(a.purchaseDate || '');
 });

 /* 页面筛选 */
 if (!PageFilter._rendered_fabric) { PageFilter.renderBar('fabric'); PageFilter._rendered_fabric = true; }
 fabrics = fabrics.filter(function(f) { return PageFilter.matchItem('fabric', f); });
 
  /* 过滤已用完布料 */
 var showDepleted = localStorage.getItem('sewing_show_depleted') === 'true';
 if (!showDepleted) {
 fabrics = fabrics.filter(function(f) {
 return Calculator.remainingMeters(f.id, f.meters, products, scraps) > 0;
 });
 }
 
 if (fabrics.length === 0) {
 container.className = 'fabric-list';
 container.innerHTML = '<div class="fabric-empty">还没有布料记录，点击上方按钮添加吧！</div>';
 return;
 }

 /* 列表视图：表格 */
 if (mode === 'list') {
 var html = '<div class="list-table-wrapper"><div class="list-table">';
 html += '<div class="list-table-header">';
 html += '<span class="lt-col lt-col-name">名称</span>';
 html += '<span class="lt-col lt-col-shop">店铺</span>';
 html += '<span class="lt-col lt-col-meters">米数</span>';
 html += '<span class="lt-col lt-col-price">价格</span>';
 html += '<span class="lt-col lt-col-unit">单价</span>';
 html += '<span class="lt-col lt-col-remaining">剩余</span>';
 html += '<span class="lt-col lt-col-rating">评级</span>';
 html += '<span class="lt-col lt-col-weight">克重</span>';
 html += '<span class="lt-col lt-col-actions">操作</span>';
 html += '</div>';
 fabrics.forEach(function(fabric) {
 var up = Calculator.unitPrice(fabric.price, fabric.meters);
 var remaining = Calculator.remainingMeters(fabric.id, fabric.meters, products, scraps);
 html += '<div class="list-table-row">';
 html += '<span class="lt-col lt-col-name">' + self.escapeHtml(fabric.name) + '</span>';
 html += '<span class="lt-col lt-col-shop">' + self.escapeHtml(fabric.shop || '-') + '</span>';
 html += '<span class="lt-col lt-col-meters">' + fabric.meters + '</span>';
 html += '<span class="lt-col lt-col-price">¥' + fabric.price + '</span>';
 html += '<span class="lt-col lt-col-unit">¥' + up.toFixed(2) + '</span>';
 html += '<span class="lt-col lt-col-remaining" style="color:' + (remaining < 0.5 ? 'var(--coral)' : 'var(--green-dark)') + '">' + remaining + '</span>';
 html += '<span class="lt-col lt-col-rating">' + (fabric.quality ? self.renderStarDisplay(fabric.quality) : '-') + '</span>';
 html += '<span class="lt-col lt-col-weight">' + self.escapeHtml(fabric.weight || '-') + '</span>';
 html += '<span class="lt-col lt-col-actions"><button class="btn btn-icon" style="color:var(--green-dark)" onclick="FabricController.addMeters(\'' + fabric.id + '\')" title="追加米数">' + svgIcon('plus') + '</button> <button class="btn btn-icon btn-pink" onclick="FabricController.openForm(\'' + fabric.id + '\')" title="编辑">' + svgIcon('edit') + '</button> <button class="btn btn-icon btn-danger" onclick="FabricController.deleteFabric(\'' + fabric.id + '\')" title="删除">' + svgIcon('trash') + '</button></span>';
 html += '</div>';
 });
 html += '</div></div>';
 container.innerHTML = html;
 container.className = '';
 return;
 }

 /* 卡片视图 */
 container.className = 'fabric-list';

 var html = '';
 fabrics.forEach(function(fabric) {
 var up = Calculator.unitPrice(fabric.price, fabric.meters);
 var remaining = Calculator.remainingMeters(fabric.id, fabric.meters, products, scraps);
 var remainingClass = remaining < 0.5 ? 'fabric-card-remaining low' : 'fabric-card-remaining';

 html += '<div class="fabric-card">';
 /* 图片区域 */
 if (fabric.image) {
 var fImgId = 'fimg_' + fabric.id;
 html += '<img id="' + fImgId + '" class="fabric-card-image" alt="">';
 } else {
 html += '<div class="fabric-card-image-placeholder"></div>';
 }
 /* 信息区域 */
 html += '<div class="fabric-card-info">';
 html += '<div class="fabric-card-header">';
 html += '<span class="fabric-card-name">' + self.escapeHtml(fabric.name) + '</span>';
 html += '<div class="fabric-card-actions">';
 html += '<button class="btn btn-icon" style="color:var(--green-dark)" onclick="FabricController.addMeters(\'' + fabric.id + '\')"title="追加米数">' + svgIcon('plus') + '</button>';
 html += '<button class="btn btn-icon btn-pink" onclick="FabricController.openForm(\'' + fabric.id + '\')"title="编辑">' + svgIcon('edit') + '</button>';
 html += '<button class="btn btn-icon btn-danger" onclick="FabricController.deleteFabric(\'' + fabric.id + '\')"title="删除">' + svgIcon('trash') + '</button>';
 html += '</div></div>';
 html += '<div class="fabric-card-body">';
 if (fabric.shop) {
 html += '<div class="fabric-card-row"><span class="fabric-card-label">店铺</span><span class="fabric-card-value">' + self.escapeHtml(fabric.shop) + '</span></div>';
 }
 html += '<div class="fabric-card-row"><span class="fabric-card-label">剩余</span><span class="' + remainingClass + '">' + remaining + ' / ' + fabric.meters + ' 米</span></div>';
 if (fabric.price) {
 html += '<div class="fabric-card-row"><span class="fabric-card-label">单价</span><span class="fabric-card-value">¥' + up.toFixed(2) + '/米</span></div>';
 }
 if (fabric.quality) {
 html += '<div class="fabric-card-row"><span class="fabric-card-label">评级</span><span class="fabric-stars">' + self.renderStarDisplay(fabric.quality) + '</span></div>';
 }
 html += '</div>';
 html += '</div></div>';
 });

 container.innerHTML = html;
 
/* 异步加载 IndexedDB 图片 */
 fabrics.forEach(function(fabric) {
 if (fabric.image) {
 var imgEl = document.getElementById('fimg_' + fabric.id);
 if (imgEl) { loadIdbImage(imgEl, fabric.image); }
 }
 });

 /* 渲染报废记录 */
 this.renderScrapList();
 },

 renderScrapList() {
 var self = this;
 var scraps = Store.getAll(Store.KEYS.SCRAPS);
 var container = document.getElementById('scrapList');
 var toggle = document.getElementById('scrapToggle');
 if (!container || !toggle) return;

 /* 绑定折叠事件（只绑一次） */
 if (!toggle._bound) {
 toggle._bound = true;
 toggle.addEventListener('click', function() {
 var isHidden = container.style.display === 'none';
 container.style.display = isHidden ? 'block' : 'none';
 var arrow = toggle.querySelector('.toggle-arrow');
 if (arrow) { arrow.style.transform = isHidden ? 'rotate(90deg)' : ''; }
 });
 }

 if (scraps.length === 0) {
 toggle.style.display = 'none';
 container.innerHTML = '';
 return;
 }

 toggle.style.display = '';
 scraps.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });

 var html = '<div style="display:flex;flex-direction:column;gap:6px;">';
 scraps.forEach(function(s) {
 html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:var(--bg-card);border-radius:var(--radius-sm);font-size:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">';
 html += '<span style="color:var(--text);">' + self.escapeHtml(s.fabricName) + ' — 报废 ' + s.meters + ' 米</span>';
 html += '<span style="display:flex;align-items:center;gap:8px;">';
 html += '<span style="color:var(--text-light);">' + self.escapeHtml(s.date || '') + '</span>';
 html += '<button class="btn btn-icon btn-danger" onclick="FabricController.deleteScrap(\'' + s.id + '\')" title="撤销报废" style="font-size:11px;">↺</button>';
 html += '</span></div>';
 });
 html += '</div>';
 container.innerHTML = html;
 },

 deleteScrap(id) {
 DeleteConfirm.show('确定要撤销这条报废记录吗？布料剩余米数将恢复。', function() {
 Store.remove(Store.KEYS.SCRAPS, id);
 Toast.show('报废记录已撤销', 'success');
 FabricController.renderList();
 });
 },

 escapeHtml(str) {
 if (!str) { return ''; }
 var div = document.createElement('div');
 div.textContent = str;
 return div.innerHTML;
 }
};

/* ========== ProductController 模块 ========== */
const ProductController = {
 editingId: null,
 imageBase64: '',
 imageKey: '',
 pendingTodoId: null,

 init() {
 var self = this;
 document.getElementById('btnAddProduct').addEventListener('click', function() {
 self.openForm();
 });
 document.getElementById('btnCancelProduct').addEventListener('click', function() {
 self.closeForm();
 });
 document.getElementById('btnSaveCopyProduct').addEventListener('click', function() {
 self.handleSubmit(true);
 });
 document.getElementById('productForm').addEventListener('submit', function(e) {
 e.preventDefault();
 self.handleSubmit(false);
 });
 document.getElementById('productFormOverlay').addEventListener('click', function(e) {
/*点击外部不关闭*/
 });
 document.getElementById('productImageInput').addEventListener('change', function(e) {
 self.handleImageUpload(e);
 });
 document.getElementById('productImageRemove').addEventListener('click', function() {
 self.removeImage();
 });
 document.getElementById('btnAddFabricUsage').addEventListener('click', function() {
 self.addFabricUsageRow();
 });

 /* 纸样来源类型切换 */
 document.getElementById('productPatternType').addEventListener('change', function() {
 self.handlePatternTypeChange();
 });

 /* 纸样关联：选择已有纸样时清空新建区 */
 document.getElementById('productPatternSelect').addEventListener('change', function() {
 if (this.value) {
 document.getElementById('newPatternFields').style.display = 'none';
 document.getElementById('productPatternSource').value = '';
 document.getElementById('productPatternCode').value = '';
 document.getElementById('productPatternId').value = this.value;
 } else {
 document.getElementById('productPatternId').value = '';
 }
 });

 /* 快速新建纸样折叠 */
 document.getElementById('newPatternToggle').addEventListener('click', function() {
 var fields = document.getElementById('newPatternFields');
 var isHidden = fields.style.display === 'none';
 fields.style.display = isHidden ? 'block' : 'none';
 if (isHidden) {
 document.getElementById('productPatternSelect').value = '';
 document.getElementById('productPatternId').value = '';
 self.populatePatternSourceOptions('');
 }
 });

 /* 完成日期变化时更新自制编号 */
 document.getElementById('productCompletedDate').addEventListener('change', function() {
 if (document.getElementById('productPatternType').value === '自制打板') {
 document.getElementById('productDiyCode').value = self.generateDIYCode();
 }
 });
 
 /* Ctrl+V 粘贴图片 */
 document.getElementById('productForm').addEventListener('paste', function(e) {
 var items = (e.clipboardData || e.originalEvent.clipboardData).items;
 for (var i = 0; i < items.length; i++) {
 if (items[i].type.indexOf('image') !== -1) {
 e.preventDefault();
 var blob = items[i].getAsFile();
 var reader = new FileReader();
 reader.onload = function(ev) {
 guardImageUpload(function() {
 ProductController.imageBase64 = ev.target.result;
 var imageKey = 'img_' + generateUUID();
 ImageStore.save(imageKey, ev.target.result);
 ProductController.imageKey = 'idb:' + imageKey;
 document.getElementById('productImageThumb').src = ev.target.result;
 document.getElementById('productImagePreview').style.display = 'block';
 document.getElementById('productImageArea').querySelector('.upload-hint').textContent = '已粘贴照片，点击更换';
 });
 };
 reader.readAsDataURL(blob);
 break;
 }
 }
 });

 /* 视图切换 */
 document.getElementById('productViewToggle').addEventListener('click', function(e) {
 var btn = e.target.closest('.view-toggle-btn');
 if (!btn) return;
 var mode = btn.getAttribute('data-mode');
 ViewToggle.setMode('product', mode);
 document.querySelectorAll('#productViewToggle .view-toggle-btn').forEach(function(b) {
 b.classList.toggle('active', b.getAttribute('data-mode') === mode);
 });
 document.getElementById('productExpandBtns').style.display = (mode === 'card') ? '' : 'none';
 self.renderList();
 });

 this.renderList();

 Router.onNavigate(function(page) {
 if (page === 'product') {
 PageFilter._rendered_product = false;
 self.renderList();
 }
 });
 },

 populateCategoryOptions(selectedValue) {
 var select = document.getElementById('productCategory');
 var options = OptionController.getOptions('productCategory');
 select.innerHTML = '<option value="">请选择类别</option>';
 options.forEach(function(opt) {
 var o = document.createElement('option');
 o.value = opt;
 o.textContent = opt;
 if (opt === selectedValue) { o.selected = true; }
 select.appendChild(o);
 });
 var addOpt = document.createElement('option');
 addOpt.value = '__add_new__';
 addOpt.textContent = '+ 新增选项...';
 select.appendChild(addOpt);

 select.onchange = function() {
 if (select.value === '__add_new__') {
 var newVal = prompt('请输入新的类别名称：');
 if (newVal && newVal.trim()) {
 OptionController.addOption('productCategory', newVal.trim());
 ProductController.populateCategoryOptions(newVal.trim());
 } else {
 select.value = selectedValue || '';
 }
 }
 };
 },

populateUserOptions(selectedValue) {
 var select = document.getElementById('productUser');
 var options = OptionController.getOptions('productUser');
 select.innerHTML = '<option value="">请选择使用者</option>';
 options.forEach(function(opt) {
 var o = document.createElement('option');
 o.value = opt;
 o.textContent = opt;
 if (opt === selectedValue) { o.selected = true; }
 select.appendChild(o);
 });
 var addOpt = document.createElement('option');
 addOpt.value = '__add_new__';
 addOpt.textContent = '+ 新增选项...';
 select.appendChild(addOpt);

 select.onchange = function() {
 if (select.value === '__add_new__') {
 var newVal = prompt('请输入新的使用者名称：');
 if (newVal && newVal.trim()) {
 OptionController.addOption('productUser', newVal.trim());
 ProductController.populateUserOptions(newVal.trim());
 } else {
 select.value = selectedValue || '';
 }
 }
 };
 },

handlePatternTypeChange() {
var type = document.getElementById('productPatternType').value;
var patternLinkSection = document.getElementById('patternLinkSection');
var diyCodeSection = document.getElementById('diyCodeSection');

patternLinkSection.style.display = 'none';
diyCodeSection.style.display = 'none';
document.getElementById('newPatternFields').style.display = 'none';
document.getElementById('productPatternId').value = '';
document.getElementById('productPatternSelect').value = '';
document.getElementById('productPatternSource').value = '';
document.getElementById('productPatternCode').value = '';
document.getElementById('productDiyCode').value = '';

if (type === '纸样') {
patternLinkSection.style.display = 'block';
this.populatePatternSelect('');
} else if (type === '自制打板') {
diyCodeSection.style.display = 'block';
document.getElementById('productDiyCode').value = this.generateDIYCode();
}
},

populatePatternSourceOptions(selectedValue) {
var select = document.getElementById('productPatternSource');
var patternOptions = OptionController.getOptions('patternBrand');

select.innerHTML = '<option value="">请选择来源</option>';

patternOptions.forEach(function(opt) {
var o = document.createElement('option');
o.value = opt;
o.textContent = opt;
if (opt === selectedValue) { o.selected = true; }
select.appendChild(o);
});

var addOpt = document.createElement('option');
addOpt.value = '__add_new__';
addOpt.textContent = '+ 新增选项...';
select.appendChild(addOpt);

select.onchange = function() {
if (select.value === '__add_new__') {
var newVal = prompt('请输入新的纸样来源：');
if (newVal && newVal.trim()) {
OptionController.addOption('patternBrand', newVal.trim());
ProductController.populatePatternSourceOptions(newVal.trim());
} else {
select.value = selectedValue || '';
}
}
};
},

populatePatternSelect(selectedPatternId) {
var select = document.getElementById('productPatternSelect');
var patterns = Store.getAll(Store.KEYS.PATTERNS);
select.innerHTML = '<option value="">不关联纸样</option>';
patterns.forEach(function(p) {
var o = document.createElement('option');
o.value = p.id;
var label = p.name;
if (p.brand) label += ' (' + p.brand + ')';
if (p.code) label += ' #' + p.code;
o.textContent = label;
if (p.id === selectedPatternId) o.selected = true;
select.appendChild(o);
});
},

generateDIYCode() {
 var completedDate = document.getElementById('productCompletedDate').value;
 var dateStr;
 if (completedDate) {
 var parts = completedDate.split('-');
 dateStr = parts[0].substring(2) + parts[1] + parts[2];
 }
 else {
var now = new Date();
var y = String(now.getFullYear()).substring(2);
var m = String(now.getMonth() + 1).padStart(2, '0');
var d = String(now.getDate()).padStart(2, '0');
dateStr = y + m + d;
}

var products = Store.getAll(Store.KEYS.PRODUCTS);
var prefix = 'D' + dateStr;
var maxSeq = 0;
products.forEach(function(p) {
if (p.patternCode && p.patternCode.indexOf(prefix) === 0) {
var seqStr = p.patternCode.substring(prefix.length);
var seq = parseInt(seqStr, 10);
if (!isNaN(seq) && seq > maxSeq) {
maxSeq = seq;
}
}
});
return prefix + String(maxSeq + 1).padStart(2, '0');
},

addFabricUsageRow(fabricId, metersUsed) {
var container = document.getElementById('fabricUsageRows');
var fabrics = Store.getAll(Store.KEYS.FABRICS);
var products = Store.getAll(Store.KEYS.PRODUCTS);
var scraps = Store.getAll(Store.KEYS.SCRAPS);

var row = document.createElement('div');
row.className = 'fabric-usage-row';

var select = document.createElement('select');
select.innerHTML = '<option value="">请选择布料</option>';
fabrics.forEach(function(f) {
var remaining = Calculator.remainingMeters(f.id, f.meters, products, scraps);
/* 过滤无库存布料，但保留当前已选中的 */
if (remaining <= 0 && f.id !== fabricId) return;
var o = document.createElement('option');
o.value = f.id;
var label = f.name;
if (f.shop) label += ' (' + f.shop + ')';
label += ' [余' + remaining + '米]';
o.textContent = label;
if (f.id === fabricId) { o.selected = true; }
select.appendChild(o);
});

var inputRow = document.createElement('div');
inputRow.style.cssText = 'display:flex;gap:8px;align-items:center;';

var input = document.createElement('input');
input.type = 'number';
input.placeholder = '消耗米数';
input.step = '0.01';
input.min = '0';
input.style.flex = '1';
if (metersUsed) { input.value = metersUsed; }

var removeBtn = document.createElement('button');
removeBtn.type = 'button';
removeBtn.className = 'btn-remove-usage';
removeBtn.textContent = '✕';
removeBtn.addEventListener('click', function() {
row.remove();
});

var hint = document.createElement('div');
hint.className = 'fabric-remaining-hint';
hint.style.display = 'none';

function updateHint() {
var fid = select.value;
if (!fid) { hint.style.display = 'none'; return; }
var fabric = fabrics.find(function(f) { return f.id === fid; });
if (!fabric) { hint.style.display = 'none'; return; }
var remaining = Calculator.remainingMeters(fid, fabric.meters, products, scraps);
hint.style.display = 'inline-block';
hint.textContent = '剩余 ' + remaining + ' 米（共 ' + fabric.meters + ' 米）';
hint.className = 'fabric-remaining-hint' + (remaining < 0.5 ? ' low' : '');
}

select.addEventListener('change', updateHint);
if (fabricId) { updateHint(); }

inputRow.appendChild(input);
inputRow.appendChild(removeBtn);
row.appendChild(select);
row.appendChild(inputRow);
row.appendChild(hint);
container.appendChild(row);
},

getFabricUsages() {
var rows = document.querySelectorAll('#fabricUsageRows .fabric-usage-row');
var usages = [];
rows.forEach(function(row) {
var fabricId = row.querySelector('select').value;
var metersUsed = parseFloat(row.querySelector('input').value);
if (fabricId && metersUsed > 0) {
usages.push({ fabricId: fabricId, metersUsed: metersUsed });
}
});
return usages;
},

handleImageUpload(e) {
var self = this;
var file = e.target.files[0];
if (!file) { return; }
if (!file.type.startsWith('image/')) {
Toast.show('请选择图片文件', 'error');
return;
}
var reader = new FileReader();
reader.onload = function(ev) {
guardImageUpload(function() {
self.imageBase64 = ev.target.result;
var imageKey = 'img_' + generateUUID();
ImageStore.save(imageKey, ev.target.result);
self.imageKey = 'idb:' + imageKey;
document.getElementById('productImageThumb').src = self.imageBase64;
document.getElementById('productImagePreview').style.display = 'block';
document.getElementById('productImageArea').querySelector('.upload-hint').textContent = '已选择照片，点击更换';
});
};
reader.readAsDataURL(file);
},

removeImage() {
this.imageBase64 = '';
this.imageKey = '';
document.getElementById('productImageThumb').src = '';
document.getElementById('productImagePreview').style.display = 'none';
document.getElementById('productImageInput').value = '';
document.getElementById('productImageArea').querySelector('.upload-hint').textContent = '点击上传或 Ctrl+V 粘贴';
},

openForm(productId) {
var self = this;
this.editingId = productId || null;
this.clearFormErrors();
document.getElementById('fabricUsageRows').innerHTML = '';

this.populateCategoryOptions('');
this.populateUserOptions('');
this.populatePatternSourceOptions('');

if (productId) {
var product = Store.getById(Store.KEYS.PRODUCTS, productId);
if (!product) { return; }
document.getElementById('productFormTitle').textContent = '编辑制品';
document.getElementById('productEditId').value = productId;
document.getElementById('productName').value = product.name || '';
this.populateCategoryOptions(product.category || '');
document.getElementById('productCompletedDate').value = product.completedDate || '';
this.populateUserOptions(product.user || '');
/* 恢复纸样来源类型 */
var pType = product.patternType || '';
if (!pType) {
/* 兼容旧数据 */
if (product.patternId) pType = '纸样';
else if (product.patternSource === '自制无版') pType = '自制无版';
else if (product.patternSource === '自制打板') pType = '自制打板';
else if (product.patternSource) pType = '纸样';
}
document.getElementById('productPatternType').value = pType;
this.handlePatternTypeChange();
if (pType === '纸样') {
this.populatePatternSelect(product.patternId || '');
document.getElementById('productPatternId').value = product.patternId || '';
if (!product.patternId && product.patternSource) {
document.getElementById('newPatternFields').style.display = 'block';
this.populatePatternSourceOptions(product.patternSource || '');
document.getElementById('productPatternCode').value = product.patternCode || '';
}
} else if (pType === '自制打板' && product.patternCode) {
document.getElementById('productDiyCode').value = product.patternCode;
}
document.getElementById('productTutorialLink').value = product.tutorialLink || '';
if (product.image) {
if (product.image.startsWith('idb:')) {
self.imageKey = product.image;
ImageStore.get(product.image.substring(4)).then(function(data) {
if (data) {
self.imageBase64 = data;
document.getElementById('productImageThumb').src = data;
document.getElementById('productImagePreview').style.display = 'block';
}
});
} else {
self.imageBase64 = product.image;
self.imageKey = '';
document.getElementById('productImageThumb').src = product.image;
document.getElementById('productImagePreview').style.display = 'block';
}
} else {
this.removeImage();
}
if (product.fabricUsages && product.fabricUsages.length > 0) {
var self = this;
product.fabricUsages.forEach(function(usage) {
self.addFabricUsageRow(usage.fabricId, usage.metersUsed);
});
}
} else {
document.getElementById('productFormTitle').textContent = '添加制品';
document.getElementById('productEditId').value = '';
document.getElementById('productForm').reset();
document.getElementById('productCompletedDate').value = new Date().toISOString().split('T')[0];
this.removeImage();
document.getElementById('productPatternType').value = '';
this.handlePatternTypeChange();
}

document.getElementById('productFormOverlay').classList.add('show');
},

openFormFromTodo(todo) {
var self = this;
this.pendingTodoId = todo.id;
this.openForm();
document.getElementById('productName').value = todo.name || '';
if (todo.category) { this.populateCategoryOptions(todo.category); }
if (todo.user) { this.populateUserOptions(todo.user); }
if (todo.patternSource) {
this.populatePatternSourceOptions(todo.patternSource);
this.handlePatternSourceChange();
}
if (todo.patternCode) {
document.getElementById('productPatternCode').value = todo.patternCode;
}
if (todo.tutorialLink) {
document.getElementById('productTutorialLink').value = todo.tutorialLink;
}
if (todo.image) {
if (todo.image.startsWith('idb:')) {
self.imageKey = todo.image;
ImageStore.get(todo.image.substring(4)).then(function(data) {
if (data) {
self.imageBase64 = data;
document.getElementById('productImageThumb').src = data;
document.getElementById('productImagePreview').style.display = 'block';
}
});
} else {
self.imageBase64 = todo.image;
self.imageKey = '';
document.getElementById('productImageThumb').src = todo.image;
document.getElementById('productImagePreview').style.display = 'block';
}
}
document.getElementById('productFormTitle').textContent = '完成制品';
},

closeForm() {
document.getElementById('productFormOverlay').classList.remove('show');
this.editingId = null;
this.pendingTodoId = null;
this._duplicateSourceId = null;
this._duplicateSnapshot = null;
},

clearFormErrors() {
var groups = document.querySelectorAll('#productForm .form-group');
groups.forEach(function(g) { g.classList.remove('has-error'); });
},

showFormErrors(errors) {
this.clearFormErrors();
var fieldMap = {
name: 'productNameError',
completedDate: 'productCompletedDateError',
patternCode: 'productPatternCodeError'
};
for (var field in errors) {
var errEl = document.getElementById(fieldMap[field]);
if (errEl) {
errEl.textContent = errors[field];
errEl.parentElement.classList.add('has-error');
}
}
},

handleSubmit(copyAfter) {
var patternType = document.getElementById('productPatternType').value;
var patternId = document.getElementById('productPatternId').value;
var newPatternSource = document.getElementById('productPatternSource').value;
if (newPatternSource === '__add_new__') newPatternSource = '';
var newPatternCode = document.getElementById('productPatternCode').value.trim();

var data = {
name: document.getElementById('productName').value.trim(),
category: document.getElementById('productCategory').value === '__add_new__' ? '' : document.getElementById('productCategory').value,
completedDate: document.getElementById('productCompletedDate').value,
user: document.getElementById('productUser').value === '__add_new__' ? '' : document.getElementById('productUser').value,
patternType: patternType,
patternId: '',
patternSource: patternType,
patternCode: '',
tutorialLink: document.getElementById('productTutorialLink').value.trim(),
image: this.imageKey || this.imageBase64,
fabricUsages: this.getFabricUsages()
};

var result = Validator.validateProduct(data);
if (!result.valid) {
this.showFormErrors(result.errors);
Toast.show('请检查表单填写', 'error');
return;
}

if (patternType === '自制打板') {
data.patternCode = document.getElementById('productDiyCode').value;
} else if (patternType === '自制无版') {
data.patternCode = '';
} else if (patternType === '纸样') {
/* 快速新建纸样 */
if (!patternId && newPatternSource && newPatternCode) {
var newPattern = Store.add(Store.KEYS.PATTERNS, {
name: data.name,
brand: newPatternSource,
code: newPatternCode,
category: '',
link: '',
note: '',
image: ''
});
data.patternId = newPattern.id;
data.patternSource = newPatternSource;
data.patternCode = newPatternCode;
Toast.show('纸样已自动创建', 'success');
} else if (patternId) {
data.patternId = patternId;
var linkedPattern = Store.getById(Store.KEYS.PATTERNS, patternId);
if (linkedPattern) {
data.patternSource = linkedPattern.brand || '';
data.patternCode = linkedPattern.code || '';
}
}
}

if (this.editingId) {
Store.update(Store.KEYS.PRODUCTS, this.editingId, data);
Toast.show('制品更新成功', 'success');
} else if (this._duplicateSourceId) {
/* 判断是否与原制品完全相同（除了日期） */
var currentSnapshot = JSON.stringify({
name: data.name,
category: data.category,
completedDate: data.completedDate,
user: data.user,
patternType: data.patternType,
patternId: data.patternId,
patternSource: data.patternSource,
patternCode: data.patternCode,
tutorialLink: data.tutorialLink,
fabricUsages: data.fabricUsages
});
var origSnap = this._duplicateSnapshot || '';
/* 比较时忽略完成日期（因为默认会变成今天） */
var origObj = JSON.parse(origSnap);
origObj.completedDate = data.completedDate;
var origSnapNorm = JSON.stringify(origObj);
if (currentSnapshot === origSnapNorm) {
/* 完全没改，原制品数量+1，布料消耗也+1 */
var origProduct = Store.getById(Store.KEYS.PRODUCTS, this._duplicateSourceId);
if (origProduct) {
var newQty = (origProduct.quantity || 1) + 1;
Store.update(Store.KEYS.PRODUCTS, this._duplicateSourceId, { quantity: newQty });
/* 追加布料消耗：同布料累加米数 */
if (data.fabricUsages && data.fabricUsages.length > 0) {
var existingUsages = origProduct.fabricUsages ? JSON.parse(JSON.stringify(origProduct.fabricUsages)) : [];
data.fabricUsages.forEach(function(u) {
var found = false;
for (var i = 0; i < existingUsages.length; i++) {
if (existingUsages[i].fabricId === u.fabricId) {
existingUsages[i].metersUsed = Math.round((Number(existingUsages[i].metersUsed) + Number(u.metersUsed)) * 100) / 100;
found = true;
break;
}
}
if (!found) { existingUsages.push({ fabricId: u.fabricId, metersUsed: u.metersUsed }); }
});
Store.update(Store.KEYS.PRODUCTS, this._duplicateSourceId, { fabricUsages: existingUsages });
}
Toast.show('数量已更新为 ×' + newQty, 'success');
}
} else {
Store.add(Store.KEYS.PRODUCTS, data);
Toast.show('制品添加成功', 'success');
}
this._duplicateSourceId = null;
this._duplicateSnapshot = null;
} else {
Store.add(Store.KEYS.PRODUCTS, data);
Toast.show('制品添加成功', 'success');
}

if (this.pendingTodoId) {
Store.update(Store.KEYS.TODOS, this.pendingTodoId, { completed: true });
this.pendingTodoId = null;
TodoController.renderList();
}

this.closeForm();
this.renderList();

if (copyAfter) {
var self = this;
var savedData = JSON.parse(JSON.stringify(data));
setTimeout(function() {
self.openForm();
document.getElementById('productName').value = savedData.name;
self.populateCategoryOptions(savedData.category);
document.getElementById('productCompletedDate').value = savedData.completedDate;
self.populateUserOptions(savedData.user);
self.populatePatternSourceOptions(savedData.patternSource);
self.handlePatternSourceChange();
document.getElementById('productPatternCode').value = savedData.patternCode;
document.getElementById('productTutorialLink').value = savedData.tutorialLink;
if (savedData.image) {
self.imageKey = savedData.image;
if (savedData.image.startsWith('idb:')) {
ImageStore.get(savedData.image.substring(4)).then(function(imgData) {
if (imgData) {
self.imageBase64 = imgData;
document.getElementById('productImageThumb').src = imgData;
document.getElementById('productImagePreview').style.display = 'block';
}
});
}
}
if (savedData.fabricUsages && savedData.fabricUsages.length > 0) {
savedData.fabricUsages.forEach(function(usage) {
self.addFabricUsageRow(usage.fabricId, usage.metersUsed);
});
}
}, 100);
}
},

deleteProduct(id) {
DeleteConfirm.show('确定要删除这条制品记录吗？此操作不可撤销。', function() {
Store.remove(Store.KEYS.PRODUCTS, id);
Toast.show('制品已删除', 'success');
ProductController.renderList();
});
},

/* 发布为作品（community-and-monetization 任务11） */
openPublishDialog(productId) {
if (!window.Auth || !Auth.currentUser) { Toast.show('请先登录', 'error'); return; }
var product = Store.getById(Store.KEYS.PRODUCTS, productId);
if (!product) { Toast.show('制品不存在', 'error'); return; }

var old = document.getElementById('publishDialogOverlay');
if (old) old.parentNode.removeChild(old);

var noImageHint = product.image ? '' :
'<div style="font-size:12px;color:var(--coral);margin-bottom:10px;">建议先为该制品添加图片，作品展示效果更好。</div>';

var overlay = document.createElement('div');
overlay.id = 'publishDialogOverlay';
overlay.style.cssText = 'position:fixed;inset:0;background:rgba(30,30,30,0.3);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:9997;display:flex;justify-content:center;align-items:center;padding:20px;';
var box = document.createElement('div');
box.style.cssText = 'background:#fff;border-radius:18px;box-shadow:0 12px 40px rgba(0,0,0,0.15);padding:28px;max-width:440px;width:100%;border:1px solid var(--border);animation:formSlideIn 0.3s ease;';
box.innerHTML =
'<div style="font-size:18px;font-weight:700;color:var(--blue-dark);margin-bottom:18px;">发布为作品</div>' +
noImageHint +
'<div class="form-group"><label>作品标题</label><input type="text" id="publishTitle" value="' + this.escapeHtml(product.name || '') + '"></div>' +
'<div class="form-group"><label>作品描述（可选）</label><input type="text" id="publishDesc" placeholder="说点什么，比如制作心得"></div>' +
'<label style="display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--text);margin:6px 0 18px;cursor:pointer;">' +
'<input type="checkbox" id="publishShowCost" style="width:16px;height:16px;">公开成本信息（默认不公开）</label>' +
'<div style="display:flex;gap:10px;justify-content:flex-end;">' +
'<button class="btn btn-gray" id="publishCancel">取消</button>' +
'<button class="btn btn-purple" id="publishConfirm">发布</button></div>';
overlay.appendChild(box);
document.body.appendChild(overlay);

function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
document.getElementById('publishCancel').addEventListener('click', close);
document.getElementById('publishConfirm').addEventListener('click', function() {
var options = {
title: document.getElementById('publishTitle').value.trim(),
description: document.getElementById('publishDesc').value.trim(),
showCost: document.getElementById('publishShowCost').checked
};
var btn = this; btn.disabled = true; btn.textContent = '发布中...';
CommunityStore.publishPost(productId, options).then(function(res) {
if (res && res.ok) {
Toast.show('作品已发布 🎉', 'success');
close();
} else if (res && res.needLogin) {
Toast.show('请先登录', 'error');
btn.disabled = false; btn.textContent = '发布';
} else {
Toast.show('发布失败：' + ((res && res.error) || '未知错误'), 'error');
btn.disabled = false; btn.textContent = '发布';
}
});
});
},

duplicateProduct(id) {
var product = Store.getById(Store.KEYS.PRODUCTS, id);
if (!product) return;
this._duplicateSourceId = id;
this._duplicateSnapshot = JSON.stringify({
name: product.name || '',
category: product.category || '',
completedDate: product.completedDate || '',
user: product.user || '',
patternType: product.patternType || '',
patternId: product.patternId || '',
patternSource: product.patternSource || '',
patternCode: product.patternCode || '',
tutorialLink: product.tutorialLink || '',
fabricUsages: product.fabricUsages || []
});
this.openForm();
/* 填充字段 */
var self = this;
document.getElementById('productFormTitle').textContent = '再做一件';
document.getElementById('productName').value = product.name || '';
this.populateCategoryOptions(product.category || '');
document.getElementById('productCompletedDate').value = new Date().toISOString().split('T')[0];
this.populateUserOptions(product.user || '');
var pType = product.patternType || '';
if (!pType) {
if (product.patternId) pType = '纸样';
else if (product.patternSource === '自制无版') pType = '自制无版';
else if (product.patternSource === '自制打板') pType = '自制打板';
else if (product.patternSource) pType = '纸样';
}
document.getElementById('productPatternType').value = pType;
this.handlePatternTypeChange();
if (pType === '纸样') {
this.populatePatternSelect(product.patternId || '');
document.getElementById('productPatternId').value = product.patternId || '';
} else if (pType === '自制打板' && product.patternCode) {
document.getElementById('productDiyCode').value = product.patternCode;
}
document.getElementById('productTutorialLink').value = product.tutorialLink || '';
if (product.image) {
self.imageKey = product.image;
if (product.image.startsWith('idb:')) {
ImageStore.get(product.image.substring(4)).then(function(data) {
if (data) { self.imageBase64 = data; document.getElementById('productImageThumb').src = data; document.getElementById('productImagePreview').style.display = 'block'; }
});
}
}
if (product.fabricUsages && product.fabricUsages.length > 0) {
product.fabricUsages.forEach(function(usage) {
self.addFabricUsageRow(usage.fabricId, usage.metersUsed);
});
}
},

renderList() {
var self = this;
var products = Store.getAll(Store.KEYS.PRODUCTS);
var fabrics = Store.getAll(Store.KEYS.FABRICS);
var container = document.getElementById('productList');
var mode = ViewToggle.getMode('product');

 /* 按完成日期倒序 */
 products.sort(function(a, b) {
 return (b.completedDate || '').localeCompare(a.completedDate || '');
 });

/* 页面筛选 */
if (!PageFilter._rendered_product) { PageFilter.renderBar('product'); PageFilter._rendered_product = true; }
products = products.filter(function(p) { return PageFilter.matchItem('product', p); });
 
if (products.length === 0) {
container.className = 'product-list';
container.innerHTML = '<div class="product-empty">还没有制品记录，点击上方按钮添加吧！</div>';
return;
}

var fabricMap = {};
fabrics.forEach(function(f) { fabricMap[f.id] = f; });

/* 列表视图：表格 */
if (mode === 'list') {
var html = '<div class="list-table-wrapper"><div class="list-table">';
html += '<div class="list-table-header">';
html += '<span class="lt-col lt-col-name">名称</span>';
html += '<span class="lt-col lt-col-category">类别</span>';
html += '<span class="lt-col lt-col-date">完成时间</span>';
html += '<span class="lt-col lt-col-user">使用者</span>';
html += '<span class="lt-col lt-col-pattern">纸样来源</span>';
html += '<span class="lt-col lt-col-tutorial">教程</span>';
html += '<span class="lt-col lt-col-actions">操作</span>';
html += '</div>';
products.forEach(function(product) {
html += '<div class="list-table-row">';
html += '<span class="lt-col lt-col-name">' + self.escapeHtml(product.name) + '</span>';
html += '<span class="lt-col lt-col-category">' + self.escapeHtml(product.category || '-') + '</span>';
html += '<span class="lt-col lt-col-date">' + self.escapeHtml(product.completedDate || '-') + '</span>';
html += '<span class="lt-col lt-col-user">' + self.escapeHtml(product.user || '-') + '</span>';
html += '<span class="lt-col lt-col-pattern">' + self.escapeHtml(product.patternSource || '-') + '</span>';
if (product.tutorialLink) {
html += '<span class="lt-col lt-col-tutorial"><a href="' + ensureUrl(product.tutorialLink) + '" target="_blank" style="color:var(--blue);text-decoration:underline;">查看</a></span>';
} else {
html += '<span class="lt-col lt-col-tutorial">-</span>';
}
html += '<span class="lt-col lt-col-actions"><button class="btn btn-icon" style="color:var(--green-dark)" onclick="ProductController.duplicateProduct(\'' + product.id + '\')" title="再做一件">' + svgIcon('plus') + '</button> <button class="btn btn-icon btn-purple" onclick="ProductController.openForm(\'' + product.id + '\')" title="编辑">' + svgIcon('edit') + '</button> <button class="btn btn-icon btn-danger" onclick="ProductController.deleteProduct(\'' + product.id + '\')" title="删除">' + svgIcon('trash') + '</button></span>';
html += '</div>';
});
html += '</div></div>';
container.innerHTML = html;
container.className = '';
return;
}

/* 卡片视图 */
container.className = 'product-list';

var html = '';
products.forEach(function(product) {
html += '<div class="product-card">';
/* 图片区域 */
if (product.image) {
var pImgId = 'pimg_' + product.id;
html += '<img id="' + pImgId + '" class="product-card-image" alt="">';
} else {
html += '<div class="product-card-image-placeholder"></div>';
}
/* 信息区域 */
html += '<div class="product-card-info">';
html += '<div class="product-card-header">';
html += '<span class="product-card-name">' + self.escapeHtml(product.name) + '</span>';
html += '<div class="product-card-actions">';
html += '<button class="btn btn-icon" style="color:var(--blue-dark)" onclick="ProductController.openPublishDialog(\'' + product.id + '\')" title="发布为作品">' + svgIcon('share') + '</button>';
html += '<button class="btn btn-icon" style="color:var(--green-dark)" onclick="ProductController.duplicateProduct(\'' + product.id + '\')" title="再做一件">' + svgIcon('plus') + '</button>';
html += '<button class="btn btn-icon btn-purple" onclick="ProductController.openForm(\'' + product.id + '\')"title="编辑">' + svgIcon('edit') + '</button>';
html += '<button class="btn btn-icon btn-danger" onclick="ProductController.deleteProduct(\'' + product.id + '\')"title="删除">' + svgIcon('trash') + '</button>';
html += '</div></div>';
html += '<div class="product-card-body">';
if (product.category) {
html += '<div class="product-card-row"><span class="product-card-label">类别</span><span class="product-card-value">' + self.escapeHtml(product.category) + '</span></div>';
}
if (product.completedDate) {
html += '<div class="product-card-row"><span class="product-card-label">完成</span><span class="product-card-value">' + self.escapeHtml(product.completedDate) + '</span></div>';
}
if (product.user) {
html += '<div class="product-card-row"><span class="product-card-label">使用者</span><span class="product-card-value">' + self.escapeHtml(product.user) + '</span></div>';
}
var qty = product.quantity || 1;
if (qty > 1) {
html += '<div class="product-card-row"><span class="product-card-label">数量</span><span class="product-card-value" style="color:var(--green-dark);">×' + qty + '</span></div>';
}
html += '</div>';
html += '</div></div>';
});

container.innerHTML = html;

/* 异步加载 IndexedDB 图片 */
 products.forEach(function(product) {
 if (product.image) {
 var imgEl = document.getElementById('pimg_' + product.id);
 if (imgEl) { loadIdbImage(imgEl, product.image); }
 }
 });
},

escapeHtml(str) {
if (!str) { return ''; }
var div = document.createElement('div');
div.textContent = str;
return div.innerHTML;
}
};

/* ========== TodoController 模块 ========== */
const TodoController = {
 draggedItem: null,
 todoImageBase64: '',
 todoImageKey: '',
 editingId: null,

 init() {
 var self = this;
 document.getElementById('btnAddTodo').addEventListener('click', function() {
 self.openForm();
 });
 document.getElementById('btnCancelTodo').addEventListener('click', function() {
 self.closeForm();
 });
 document.getElementById('btnSaveCopyTodo').addEventListener('click', function() {
 self.handleSubmit(true);
 });
 document.getElementById('todoForm').addEventListener('submit', function(e) {
 e.preventDefault();
 self.handleSubmit(false);
 });
 document.getElementById('todoFormOverlay').addEventListener('click', function(e) {
/*点击外部不关闭*/
 });
 document.getElementById('todoFormImageInput').addEventListener('change', function(e) {
 self.handleImageUpload(e);
 });
 document.getElementById('todoFormImageRemove').addEventListener('click', function() {
 self.removeImage();
 });

 this.renderList();

 Router.onNavigate(function(page) {
 if (page === 'todo') {
 PageFilter._rendered_todo = false;
 self.renderList();
 }
 });
 },

 handleImageUpload(e) {
 var self = this;
 var file = e.target.files[0];
 if (!file) { return; }
 if (!file.type.startsWith('image/')) {
 Toast.show('请选择图片文件', 'error');
 return;
 }
 var reader = new FileReader();
 reader.onload = function(ev) {
 guardImageUpload(function() {
 self.todoImageBase64 = ev.target.result;
 var imageKey = 'img_' + generateUUID();
 ImageStore.save(imageKey, ev.target.result);
 self.todoImageKey = 'idb:' + imageKey;
 document.getElementById('todoFormImageThumb').src = self.todoImageBase64;
 document.getElementById('todoFormImagePreview').style.display = 'block';
 document.getElementById('todoFormImageArea').querySelector('.upload-hint').textContent = '已选择图片，点击更换';
 });
 };
 reader.readAsDataURL(file);
 },

 removeImage() {
 this.todoImageBase64 = '';
 this.todoImageKey = '';
 document.getElementById('todoFormImageThumb').src = '';
 document.getElementById('todoFormImagePreview').style.display = 'none';
 document.getElementById('todoFormImageInput').value = '';
 document.getElementById('todoFormImageArea').querySelector('.upload-hint').textContent = '点击或拖拽上传图片';
 },

 populateCategoryOptions(selectedValue) {
 var select = document.getElementById('todoFormCategory');
 var options = OptionController.getOptions('productCategory');
 select.innerHTML = '<option value="">请选择类别</option>';
 options.forEach(function(opt) {
 var o = document.createElement('option');
 o.value = opt;
 o.textContent = opt;
 if (opt === selectedValue) { o.selected = true; }
 select.appendChild(o);
 });
 var addOpt = document.createElement('option');
 addOpt.value = '__add_new__';
 addOpt.textContent = '+ 新增选项...';
 select.appendChild(addOpt);
 select.onchange = function() {
 if (select.value === '__add_new__') {
 var newVal = prompt('请输入新的类别名称：');
 if (newVal && newVal.trim()) {
 OptionController.addOption('productCategory', newVal.trim());
 TodoController.populateCategoryOptions(newVal.trim());
 } else {
 select.value = selectedValue || '';
 }
 }
 };
 },

 populateUserOptions(selectedValue) {
 var select = document.getElementById('todoFormUser');
 var options = OptionController.getOptions('productUser');
 select.innerHTML = '<option value="">请选择使用者</option>';
 options.forEach(function(opt) {
 var o = document.createElement('option');
 o.value = opt;
 o.textContent = opt;
 if (opt === selectedValue) { o.selected = true; }
 select.appendChild(o);
 });
 var addOpt = document.createElement('option');
 addOpt.value = '__add_new__';
 addOpt.textContent = '+ 新增选项...';
 select.appendChild(addOpt);
 select.onchange = function() {
 if (select.value === '__add_new__') {
 var newVal = prompt('请输入新的使用者名称：');
 if (newVal && newVal.trim()) {
 OptionController.addOption('productUser', newVal.trim());
 TodoController.populateUserOptions(newVal.trim());
 } else {
 select.value = selectedValue || '';
 }
 }
 };
 },

 populatePatternSourceOptions(selectedValue) {
 var select = document.getElementById('todoFormPatternSource');
 var patternOptions = OptionController.getOptions('patternSource');
 select.innerHTML = '<option value="">请选择纸样来源</option>';
 patternOptions.forEach(function(opt) {
 var o = document.createElement('option');
 o.value = opt;
 o.textContent = opt;
 if (opt === selectedValue) { o.selected = true; }
 select.appendChild(o);
 });
 var addOpt = document.createElement('option');
 addOpt.value = '__add_new__';
 addOpt.textContent = '+ 新增选项...';
 select.appendChild(addOpt);
 select.onchange = function() {
 if (select.value === '__add_new__') {
 var newVal = prompt('请输入新的纸样来源：');
 if (newVal && newVal.trim()) {
 OptionController.addOption('patternSource', newVal.trim());
 TodoController.populatePatternSourceOptions(newVal.trim());
 } else {
 select.value = selectedValue || '';
 }
 }
 };
 },

 openForm(todoId) {
 var self = this;
 this.editingId = todoId || null;
 this.clearFormErrors();
 this.populateCategoryOptions('');
 this.populateUserOptions('');
 this.populatePatternSourceOptions('');

 if (todoId) {
 var todo = Store.getById(Store.KEYS.TODOS, todoId);
 if (!todo) { return; }
 document.getElementById('todoFormTitle').textContent = '编辑待做';
 document.getElementById('todoFormName').value = todo.name || '';
 this.populateCategoryOptions(todo.category || '');
 document.getElementById('todoFormPlannedDate').value = todo.plannedDate || '';
 this.populateUserOptions(todo.user || '');
 this.populatePatternSourceOptions(todo.patternSource || '');
 document.getElementById('todoFormPatternCode').value = todo.patternCode || '';
 document.getElementById('todoFormTutorialLink').value = todo.tutorialLink || '';
 document.getElementById('todoFormNote').value = todo.note || '';
 if (todo.image) {
 if (todo.image.startsWith('idb:')) {
 self.todoImageKey = todo.image;
 ImageStore.get(todo.image.substring(4)).then(function(data) {
 if (data) {
 self.todoImageBase64 = data;
 document.getElementById('todoFormImageThumb').src = data;
 document.getElementById('todoFormImagePreview').style.display = 'block';
 }
 });
 } else {
 self.todoImageBase64 = todo.image;
 self.todoImageKey = '';
 document.getElementById('todoFormImageThumb').src = todo.image;
 document.getElementById('todoFormImagePreview').style.display = 'block';
 }
 } else {
 this.removeImage();
 }
 } else {
 document.getElementById('todoFormTitle').textContent = '添加待做';
 document.getElementById('todoForm').reset();
 this.removeImage();
 }

 document.getElementById('todoFormOverlay').classList.add('show');
 },

 closeForm() {
 document.getElementById('todoFormOverlay').classList.remove('show');
 this.editingId = null;
 },

 clearFormErrors() {
 var groups = document.querySelectorAll('#todoForm .form-group');
 groups.forEach(function(g) { g.classList.remove('has-error'); });
 },

 handleSubmit(copyAfter) {
 var name = document.getElementById('todoFormName').value.trim();
 var category = document.getElementById('todoFormCategory').value;
 if (category === '__add_new__') { category = ''; }
 var plannedDate = document.getElementById('todoFormPlannedDate').value;
 var user = document.getElementById('todoFormUser').value;
 if (user === '__add_new__') { user = ''; }
 var patternSource = document.getElementById('todoFormPatternSource').value;
 if (patternSource === '__add_new__') { patternSource = ''; }
 var patternCode = document.getElementById('todoFormPatternCode').value.trim();
 var tutorialLink = document.getElementById('todoFormTutorialLink').value.trim();
 var note = document.getElementById('todoFormNote').value.trim();

 var result = Validator.validateTodo({ name: name });
 if (!result.valid) {
 var errEl = document.getElementById('todoFormNameError');
 errEl.textContent = result.errors.name;
 errEl.parentElement.classList.add('has-error');
 Toast.show('请检查表单填写', 'error');
 return;
 }

 var data = {
 name: name,
 category: category,
 plannedDate: plannedDate,
 user: user,
 patternSource: patternSource,
 patternCode: patternCode,
 tutorialLink: tutorialLink,
 image: this.todoImageKey || this.todoImageBase64 || '',
 note: note,
 completed: false
 };

 if (this.editingId) {
 Store.update(Store.KEYS.TODOS, this.editingId, data);
 Toast.show('待做项更新成功', 'success');
 } else {
 var todos = Store.getAll(Store.KEYS.TODOS);
 var maxOrder = 0;
 todos.forEach(function(t) {
 if (!t.completed && t.sortOrder > maxOrder) {
 maxOrder = t.sortOrder;
 }
 });
 data.sortOrder = maxOrder + 1;
 Store.add(Store.KEYS.TODOS, data);
 Toast.show('待做项添加成功', 'success');
 }

 this.closeForm();
 this.renderList();

 if (copyAfter) {
 var self = this;
 var savedData = JSON.parse(JSON.stringify(data));
 setTimeout(function() {
 self.openForm();
 document.getElementById('todoFormName').value = savedData.name;
 self.populateCategoryOptions(savedData.category);
 document.getElementById('todoFormPlannedDate').value = savedData.plannedDate;
 self.populateUserOptions(savedData.user);
 self.populatePatternSourceOptions(savedData.patternSource);
 document.getElementById('todoFormPatternCode').value = savedData.patternCode;
 document.getElementById('todoFormTutorialLink').value = savedData.tutorialLink;
 document.getElementById('todoFormNote').value = savedData.note;
 if (savedData.image) {
 self.todoImageKey = savedData.image;
 if (savedData.image.startsWith('idb:')) {
 ImageStore.get(savedData.image.substring(4)).then(function(imgData) {
 if (imgData) {
 self.todoImageBase64 = imgData;
 document.getElementById('todoFormImageThumb').src = imgData;
 document.getElementById('todoFormImagePreview').style.display = 'block';
 }
 });
 }
 }
 }, 100);
 }
 },

 deleteTodo(id) {
 DeleteConfirm.show('确定要删除这条待做记录吗？此操作不可撤销。', function() {
 Store.remove(Store.KEYS.TODOS, id);
 Toast.show('待做项已删除', 'success');
 TodoController.renderList();
 });
 },
 
 completeTodo(id) {
 var todo = Store.getById(Store.KEYS.TODOS, id);
 if (!todo) return;
 ProductController.openFormFromTodo(todo);
 },

 getActiveTodos() {
 var todos = Store.getAll(Store.KEYS.TODOS);
 return todos
 .filter(function(t) { return !t.completed; })
 .sort(function(a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
 },

 renderList() {
 var self = this;
 var todos = this.getActiveTodos();
 var container = document.getElementById('todoList');

 /* 页面筛选 */
 if (!PageFilter._rendered_todo) { PageFilter.renderBar('todo'); PageFilter._rendered_todo = true; }
 todos = todos.filter(function(t) { return PageFilter.matchItem('todo', t); });

 if (todos.length === 0) {
 container.innerHTML = '<div class="todo-empty">还没有待做项，点击上方按钮添加吧！</div>';
 return;
 }

 var html = '';
 todos.forEach(function(todo) {
 html += '<div class="todo-item" draggable="true" data-id="' + todo.id + '">';
 if (todo.image) {
 var tImgId = 'timg_' + todo.id;
 html += '<img id="' + tImgId + '" class="todo-item-image" alt="" style="max-height:80px;height:auto;">';
 }
 html += '<div class="todo-item-body">';
 html += '<div class="todo-item-header"><span class="todo-item-name">' + self.escapeHtml(todo.name) + '</span>';
 html += '<div class="todo-item-header-actions">';
 html += '<button class="btn btn-icon btn-green" onclick="TodoController.openForm(\'' + todo.id + '\')"title="编辑">' + svgIcon('edit') + '</button>';
 html += '<button class="btn btn-icon btn-danger" onclick="TodoController.deleteTodo(\'' + todo.id + '\')"title="删除">' + svgIcon('trash') + '</button>';
 html += '<button class="btn btn-icon" onclick="TodoController.completeTodo(\'' + todo.id + '\')"title="完成">完成</button>';
 html += '</div></div>';
 /* 隐藏详情 */
 var todoExpanded = CardExpandState.getState('todo');
 html += '<div class="card-details" style="display:' + (todoExpanded ? 'block' : 'none') + ';">';
 if (todo.category) {
 html += '<div class="todo-item-note">类别：' + self.escapeHtml(todo.category) + '</div>';
 }
 if (todo.plannedDate) {
 html += '<div class="todo-item-note">计划完成：' + self.escapeHtml(todo.plannedDate) + '</div>';
 }
 if (todo.user) {
 html += '<div class="todo-item-note">使用者：' + self.escapeHtml(todo.user) + '</div>';
 }
 if (todo.patternSource) {
 html += '<div class="todo-item-note">纸样来源：' + self.escapeHtml(todo.patternSource) + '</div>';
 }
 if (todo.patternCode) {
 html += '<div class="todo-item-note">纸样编号：' + self.escapeHtml(todo.patternCode) + '</div>';
 }
 if (todo.tutorialLink) {
 html += '<div class="todo-item-note">教程：<a href="' + ensureUrl(todo.tutorialLink) + '" target="_blank" style="color:var(--blue);text-decoration:underline;">查看教程</a></div>';
 }
 if (todo.note) {
 html += '<div class="todo-item-note">备注：' + self.escapeHtml(todo.note) + '</div>';
 }
 html += '</div>';
 html += '<div class="card-expand-toggle" onclick="var d=this.previousElementSibling;if(d.style.display===\'none\'){d.style.display=\'block\';this.textContent=\'收起 ▴\';}else{d.style.display=\'none\';this.textContent=\'展开 ▾\';}">' + (todoExpanded ? '收起▴' : '展开▾') + '</div>';
 html += '</div>';
 html += '<span class="todo-drag-handle" title="拖拽排序">⠿</span>';
 html += '</div>';
 });

 container.innerHTML = html;
 
 /* 异步加载 IndexedDB 图片 */
 todos.forEach(function(todo) {
 if (todo.image) {
 var imgEl = document.getElementById('timg_' + todo.id);
 if (imgEl) { loadIdbImage(imgEl, todo.image); }
 }
 });
 
 this.bindDragEvents();
 },

 bindDragEvents() {
 var self = this;
 var items = document.querySelectorAll('#todoList .todo-item');

 items.forEach(function(item) {
 item.addEventListener('dragstart', function(e) {
 self.draggedItem = this;
 this.classList.add('dragging');
 e.dataTransfer.effectAllowed = 'move';
 e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
 });

 item.addEventListener('dragend', function() {
 this.classList.remove('dragging');
 self.draggedItem = null;
 var allItems = document.querySelectorAll('#todoList .todo-item');
 allItems.forEach(function(i) { i.classList.remove('drag-over'); });
 });

 item.addEventListener('dragover', function(e) {
 e.preventDefault();
 e.dataTransfer.dropEffect = 'move';
 if (self.draggedItem && self.draggedItem !== this) {
 this.classList.add('drag-over');
 }
 });

 item.addEventListener('dragleave', function() {
 this.classList.remove('drag-over');
 });

 item.addEventListener('drop', function(e) {
 e.preventDefault();
 this.classList.remove('drag-over');
 if (!self.draggedItem || self.draggedItem === this) { return; }

 var container = document.getElementById('todoList');
 var draggedId = self.draggedItem.getAttribute('data-id');
 var targetId = this.getAttribute('data-id');

 var allItems = Array.from(container.querySelectorAll('.todo-item'));
 var draggedIndex = allItems.indexOf(self.draggedItem);
 var targetIndex = allItems.indexOf(this);

 if (draggedIndex < targetIndex) {
 this.parentNode.insertBefore(self.draggedItem, this.nextSibling);
 } else {
 this.parentNode.insertBefore(self.draggedItem, this);
 }

 self.persistOrder();
 });
 });
 },

 persistOrder() {
 var items = document.querySelectorAll('#todoList .todo-item');
 var order = 1;
 items.forEach(function(item) {
 var id = item.getAttribute('data-id');
 Store.update(Store.KEYS.TODOS, id, { sortOrder: order });
 order++;
 });
 },

 escapeHtml(str) {
 if (!str) { return ''; }
 var div = document.createElement('div');
 div.textContent = str;
 return div.innerHTML;
 }
};

/* ========== DashboardController 模块 ========== */
const DashboardController = {
 init() {
 var self = this;
 Router.onNavigate(function(page) {
 if (page === 'dashboard') {
 self.refresh();
 }
 });
 },

 escapeHtml(str) {
 if (!str) { return ''; }
 var div = document.createElement('div');
 div.textContent = str;
 return div.innerHTML;
 },

 refresh() {
 var fabrics = Store.getAll(Store.KEYS.FABRICS);
 var products = Store.getAll(Store.KEYS.PRODUCTS);
 var container = document.getElementById('dashboardContent');

 var html = '<div class="dashboard-grid">';
 html += this.renderProAnalytics(fabrics, products);
 html += this.renderFabricGallery(fabrics, products);
 html += this.renderMonthlyTrend(fabrics, products);
 html += this.renderProductGallery(products);
 html += this.renderFabricStats(fabrics, products);
 html += this.renderPatternStats(products);
 html += '</div>';

 container.innerHTML = html;
 
 /* 异步加载看板图片 */
 fabrics.forEach(function(f) {
 if (f.image) {
 var imgEl = document.getElementById('dfimg_' + f.id);
 if (imgEl) { loadIdbImage(imgEl, f.image); }
 }
 });
 products.forEach(function(p) {
 if (p.image) {
 var imgEl = document.getElementById('dpimg_' + p.id);
 if (imgEl) { loadIdbImage(imgEl, p.image); }
 }
 });
 },

 /* Pro 数据分析卡片（community-and-monetization 任务15） */
 renderProAnalytics(fabrics, products) {
 var isPro = window.Auth && Auth.isPro();
 var html = '<div class="dashboard-card full-width" style="border-top-color:var(--purple);">';
 html += '<div class="dashboard-card-title" style="color:var(--purple-dark);">数据分析 <span style="font-size:12px;color:var(--purple);">Pro</span></div>';

 if (!isPro) {
 // 免费用户：预览 + 升级引导（需求 9.2）
 html += '<div style="position:relative;">';
 html += '<div style="filter:blur(4px);opacity:0.5;pointer-events:none;">';
 html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">总库存成本</span><span class="dashboard-stat-value">¥****</span></div>';
 html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">已消耗布料成本</span><span class="dashboard-stat-value">¥****</span></div>';
 html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">库存周转率</span><span class="dashboard-stat-value">**%</span></div>';
 html += '</div>';
 html += '<div style="text-align:center;margin-top:14px;"><button class="btn btn-purple" onclick="Paywall.show(\'analytics\')">升级 Pro 解锁数据分析</button></div>';
 html += '</div></div>';
 return html;
 }

 // Pro 用户：真实计算
 var totalStock = 0, consumedCost = 0, totalMeters = 0, usedMeters = 0;
 fabrics.forEach(function(f) {
 totalStock += parseFloat(f.price) || 0;
 totalMeters += parseFloat(f.meters) || 0;
 });
 products.forEach(function(p) {
 (p.fabricUsages || []).forEach(function(u) {
 var fb = Store.getById(Store.KEYS.FABRICS, u.fabricId);
 var tp = (fb && parseFloat(fb.price)) || 0;
 var tm = (fb && parseFloat(fb.meters)) || 0;
 var used = parseFloat(u.metersUsed) || 0;
 usedMeters += used;
 consumedCost += (tm > 0 ? (tp / tm) : 0) * used;
 });
 });
 var turnover = totalMeters > 0 ? Math.round(usedMeters / totalMeters * 1000) / 10 : 0;
 html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">总库存成本</span><span class="dashboard-stat-value">¥' + totalStock.toFixed(2) + '</span></div>';
 html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">已消耗布料成本</span><span class="dashboard-stat-value">¥' + (Math.round(consumedCost * 100) / 100).toFixed(2) + '</span></div>';
 html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">已用 / 总米数</span><span class="dashboard-stat-value">' + (Math.round(usedMeters * 10) / 10) + ' / ' + (Math.round(totalMeters * 10) / 10) + ' 米</span></div>';
 html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">库存周转率</span><span class="dashboard-stat-value">' + turnover + '%</span></div>';
 html += '</div>';
 return html;
 },

 renderFabricStats(fabrics, products) {
 var stats = Calculator.fabricStats(fabrics, products);
 var html = '<div class="dashboard-card">';
 html += '<div class="dashboard-card-title">布料统计</div>';
 html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">布料总数</span><span class="dashboard-stat-value">' + stats.total + '</span></div>';
 html += '<div class="dashboard-stat-row"><span class="dashboard-stat-label">总花费</span><span class="dashboard-stat-value">¥' + stats.totalSpent.toFixed(2) + '</span></div>';

 if (stats.shopDistribution.length > 0) {
 html += '<div style="margin-top:12px;font-size:13px;font-weight:600;color:var(--text)">各店铺购买金额分布</div>';
 html += '<div class="dashboard-bar-chart">';
 var maxAmount = stats.shopDistribution[0].amount;
 var colors = ['', 'pink', 'purple', 'green', 'orange'];
 stats.shopDistribution.forEach(function(item, index) {
 var pct = maxAmount > 0 ? Math.round(item.amount / maxAmount * 100) : 0;
 var colorClass = colors[index % colors.length];
 html += '<div class="dashboard-bar-item">';
 html += '<div class="dashboard-bar-label"><span>' + DashboardController.escapeHtml(item.shop) + '</span><span>¥' + item.amount.toFixed(2) + '</span></div>';
 html += '<div class="dashboard-bar-track"><div class="dashboard-bar-fill ' + colorClass + '" style="width:' + pct + '%"></div></div>';
 html += '</div>';
 });
 html += '</div>';
 } else {
 html += '<div class="dashboard-empty">暂无店铺数据</div>';
 }

 html += '</div>';
 return html;
 },

 renderPatternStats(products) {
 var stats = Calculator.patternStats(products);
 var html = '<div class="dashboard-card">';
 html += '<div class="dashboard-card-title">纸样统计</div>';
 
if (stats.length > 0) {
 html += '<div class="dashboard-bar-chart">';
 var maxCount = stats[0].count;
 var colors = ['', 'pink', 'purple', 'green', 'orange'];
 stats.forEach(function(item, index) {
 var pct = maxCount > 0 ? Math.round(item.count / maxCount * 100) : 0;
 var colorClass = colors[index % colors.length];
 html += '<div class="dashboard-bar-item">';
 html += '<div class="dashboard-bar-label"><span>' + DashboardController.escapeHtml(item.source) + '</span><span>' + item.count + ' 件</span></div>';
 html += '<div class="dashboard-bar-track"><div class="dashboard-bar-fill ' + colorClass + '" style="width:' + pct + '%"></div></div>';
 html += '</div>';
 });
 html += '</div>';
 } else {
 html += '<div class="dashboard-empty">暂无纸样数据</div>';
 }

 html += '</div>';
 return html;
 },

 renderAvailableFabrics(fabrics, products) {
 var available = Calculator.availableFabrics(fabrics, products);
 var html = '<div class="dashboard-card">';
 html += '<div class="dashboard-card-title">待使用布料清单</div>';

 if (available.length > 0) {
 html += '<div class="dashboard-fabric-list">';
 available.forEach(function(f) {
 html += '<div class="dashboard-fabric-item">';
 html += '<span class="dashboard-fabric-item-name">' + DashboardController.escapeHtml(f.name) + (f.shop ? ' (' + DashboardController.escapeHtml(f.shop) + ')' : '') + '</span>';
 html += '<span class="dashboard-fabric-item-meters">剩余 ' + f.remainingMeters + ' 米</span>';
 html += '</div>';
 });
 html += '</div>';
 } else {
 html += '<div class="dashboard-empty">暂无待使用布料</div>';
 }

 html += '</div>';
 return html;
 },

 renderProductStats(products) {
 var catStats = Calculator.productCategoryStats(products);
 var userStats = Calculator.productUserStats(products);
 var html = '<div class="dashboard-card">';
 html += '<div class="dashboard-card-title">制品统计</div>';

 html += '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">类别分布</div>';
 if (catStats.length > 0) {
 html += '<div class="dashboard-bar-chart">';
 var maxCat = catStats[0].count;
 var colors = ['', 'pink', 'purple', 'green', 'orange'];
 catStats.forEach(function(item, index) {
 var pct = maxCat > 0 ? Math.round(item.count / maxCat * 100) : 0;
 var colorClass = colors[index % colors.length];
 html += '<div class="dashboard-bar-item">';
 html += '<div class="dashboard-bar-label"><span>' + DashboardController.escapeHtml(item.category) + '</span><span>' + item.count + ' 件</span></div>';
 html += '<div class="dashboard-bar-track"><div class="dashboard-bar-fill ' + colorClass + '" style="width:' + pct + '%"></div></div>';
 html += '</div>';
 });
 html += '</div>';
 } else {
 html += '<div class="dashboard-empty">暂无类别数据</div>';
 }

 html += '<div style="font-size:13px;font-weight:600;color:var(--text);margin-top:16px;margin-bottom:6px">使用者分布</div>';
 if (userStats.length > 0) {
 html += '<div class="dashboard-bar-chart">';
 var maxUser = userStats[0].count;
 userStats.forEach(function(item, index) {
 var pct = maxUser > 0 ? Math.round(item.count / maxUser * 100) : 0;
 var colorClass = colors[index % colors.length];
 html += '<div class="dashboard-bar-item">';
 html += '<div class="dashboard-bar-label"><span>' + DashboardController.escapeHtml(item.user) + '</span><span>' + item.count + ' 件</span></div>';
 html += '<div class="dashboard-bar-track"><div class="dashboard-bar-fill ' + colorClass + '" style="width:' + pct + '%"></div></div>';
 html += '</div>';
 });
 html += '</div>';
 } else {
 html += '<div class="dashboard-empty">暂无使用者数据</div>';
 }

 html += '</div>';
 return html;
 },

 renderMonthlyTrend(fabrics, products) {
 var trend = Calculator.monthlyTrend(fabrics, products);
 var html = '<div class="dashboard-card full-width">';
 html += '<div class="dashboard-card-title">月度趋势</div>';

 if (trend.length > 0) {
 html += '<table class="dashboard-trend-table">';
 html += '<thead><tr><th>月份</th><th>布料购买</th><th>购买金额</th><th>制品完成</th></tr></thead>';
 html += '<tbody>';
 trend.forEach(function(item) {
 html += '<tr><td>' + DashboardController.escapeHtml(item.month) + '</td><td>' + item.fabricCount + ' 条</td><td>' + item.purchaseAmount.toFixed(2) + '</td><td>' + item.productCount + ' 件</td></tr>';
 });
 html += '</tbody></table>';
 } else {
 html += '<div class="dashboard-empty">暂无月度数据</div>';
 }

 html += '</div>';
 return html;
 },

 renderFabricGallery(fabrics, products) {
 var self = this;
 var scraps = Store.getAll(Store.KEYS.SCRAPS);
 var withImage = fabrics.filter(function(f) {
 var remaining = Calculator.remainingMeters(f.id, f.meters, products, scraps);
 return remaining > 0 && f.image;
 });
 var html = '<div class="dashboard-card full-width">';
 html += '<div class="dashboard-card-title">布料库存</div>';

 if (withImage.length > 0) {
 html += '<div class="dashboard-gallery-grid">';
 withImage.forEach(function(f) {
 var remaining = Calculator.remainingMeters(f.id, f.meters, products, scraps);
 var dfImgId = 'dfimg_' + f.id;
 html += '<div class="dashboard-gallery-item">';
 html += '<img id="' + dfImgId + '" alt="' + self.escapeHtml(f.name) + '">';
 html += '<div class="dashboard-gallery-info">';
 html += '<div class="dashboard-gallery-name">' + self.escapeHtml(f.name) + '</div>';
 html += '<div class="dashboard-gallery-detail">' + self.escapeHtml(f.shop || '-') + '</div>';
 html += '<div class="dashboard-gallery-detail">剩余 ' + remaining + ' 米</div>';
 html += '</div></div>';
 });
 html += '</div>';
 } else {
 html += '<div class="dashboard-empty">暂无带图片的库存布料</div>';
 }

 html += '</div>';
 return html;
 },

 renderProductGallery(products) {
 var self = this;
 var withImage = products.filter(function(p) { return p.image; });
 var html = '<div class="dashboard-card full-width">';
 html += '<div class="dashboard-card-title">制品作品展示</div>';

 if (withImage.length > 0) {
 html += '<div class="dashboard-gallery-grid">';
 withImage.forEach(function(p) {
 var dpImgId = 'dpimg_' + p.id;
 html += '<div class="dashboard-gallery-item">';
 html += '<img id="' + dpImgId + '" alt="' + self.escapeHtml(p.name) + '">';
 html += '<div class="dashboard-gallery-info">';
 html += '<div class="dashboard-gallery-name">' + self.escapeHtml(p.name) + '</div>';
 html += '<div class="dashboard-gallery-detail">' + self.escapeHtml(p.category || '-') + '</div>';
 html += '<div class="dashboard-gallery-detail">' + self.escapeHtml(p.completedDate || '-') + '</div>';
 html += '</div></div>';
 });
 html += '</div>';
 } else {
 html += '<div class="dashboard-empty">暂无带图片的制品</div>';
 }

 html += '</div>';
 return html;
 }
};

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

/* ========== OptionManagerController 模块 ========== */
const OptionManagerController = {
 currentField: null,
 fieldLabels: {
 fabricShop: '店铺',
 fabricWidth: '幅宽',
 productCategory: '类别',
 productUser: '使用者',
 patternSource: '纸样来源',
 patternCategory: '纸样类别',
 patternBrand: '纸样来源/品牌',
 notionCategory: '辅料类别',
 notionUnit: '辅料单位',
 notionShop: '辅料店铺'
 },
 refreshCallbacks: {
 fabricShop: function() { FabricController.populateShopOptions(document.getElementById('fabricShop').value); },
 fabricWidth: function() { FabricController.populateWidthOptions(document.getElementById('fabricWidth').value); },
 productCategory: function() {
 ProductController.populateCategoryOptions(document.getElementById('productCategory').value);
 if (document.getElementById('todoFormOverlay').classList.contains('show')) {
 TodoController.populateCategoryOptions(document.getElementById('todoFormCategory').value);
 }
 },
 productUser: function() {
 ProductController.populateUserOptions(document.getElementById('productUser').value);
 if (document.getElementById('todoFormOverlay').classList.contains('show')) {
 TodoController.populateUserOptions(document.getElementById('todoFormUser').value);
 }
 },
 patternSource: function() {
 ProductController.populatePatternSourceOptions(document.getElementById('productPatternSource').value);
 if (document.getElementById('todoFormOverlay').classList.contains('show')) {
 TodoController.populatePatternSourceOptions(document.getElementById('todoFormPatternSource').value);
 }
 },
 patternCategory: function() {
 if (typeof PatternController !== 'undefined') PatternController.populateOptions('patternFormCategory', 'patternCategory');
 },
 patternBrand: function() {
 if (typeof PatternController !== 'undefined') PatternController.populateOptions('patternFormBrand', 'patternBrand');
 },
 notionCategory: function() {
 if (typeof NotionController !== 'undefined') NotionController.populateOptions('notionFormCategory', 'notionCategory');
 },
 notionUnit: function() {
 if (typeof NotionController !== 'undefined') NotionController.populateOptions('notionFormUnit', 'notionUnit');
 },
 notionShop: function() {
 if (typeof NotionController !== 'undefined') NotionController.populateOptions('notionFormShop', 'notionShop');
 }
 },

 init() {
 var self = this;
 var buttons = document.querySelectorAll('.btn-manage-options');
 buttons.forEach(function(btn) {
 btn.addEventListener('click', function(e) {
 e.preventDefault();
 e.stopPropagation();
 var field = this.getAttribute('data-field');
 self.open(field);
 });
 });

 document.getElementById('btnCloseOptionManager').addEventListener('click', function() {
 self.close();
 });

 document.getElementById('optionManagerOverlay').addEventListener('click', function(e) {
/*点击外部不关闭*/
 });
 },
 
open(fieldName) {
 this.currentField = fieldName;
 var label = this.fieldLabels[fieldName] || fieldName;
 document.getElementById('optionManagerTitle').textContent = '管理' + label + '选项';
 this.renderList();
 document.getElementById('optionManagerOverlay').classList.add('show');
 },

 close() {
 document.getElementById('optionManagerOverlay').classList.remove('show');
 if (this.currentField && this.refreshCallbacks[this.currentField]) {
 this.refreshCallbacks[this.currentField]();
 }
 this.currentField = null;
 },

 renderList() {
 var self = this;
 var field = this.currentField;
 var options = OptionController.getOptions(field);
 var container = document.getElementById('optionManagerList');

 if (options.length === 0) {
 container.innerHTML = '<div class="option-manager-empty">暂无选项</div>';
 return;
 }

 container.innerHTML = '';
 options.forEach(function(opt, idx) {
 var item = document.createElement('div');
 item.className = 'option-manager-item';

 var text = document.createElement('span');
 text.className = 'option-manager-item-text';
 text.textContent = opt;

 var actions = document.createElement('div');
 actions.className = 'option-manager-item-actions';

var upBtn = document.createElement('button');
 upBtn.className = 'btn-move-option';
 upBtn.textContent = '↑';
 upBtn.title = '上移';
 if (idx === 0) {
 upBtn.style.visibility = 'hidden';
 }
 upBtn.addEventListener('click', function() {
 OptionController.moveOption(field, opt, 'up');
 self.renderList();
 });

 var downBtn = document.createElement('button');
 downBtn.className = 'btn-move-option';
 downBtn.textContent = '↓';
 downBtn.title = '下移';
 if (idx === options.length - 1) {
 downBtn.style.visibility = 'hidden';
 }
 downBtn.addEventListener('click', function() {
 OptionController.moveOption(field, opt, 'down');
 self.renderList();
 });
 
 var editBtn = document.createElement('button');
 editBtn.className = 'btn-edit-option';
 editBtn.innerHTML = svgIcon('edit');
 editBtn.title = '编辑';
 editBtn.addEventListener('click', function() {
 self.editOption(field, opt);
 });

 var deleteBtn = document.createElement('button');
 deleteBtn.className = 'btn-delete-option';
 deleteBtn.innerHTML = svgIcon('trash');
 deleteBtn.title = '删除';
 deleteBtn.addEventListener('click', function() {
 self.deleteOption(field, opt);
 });

 actions.appendChild(upBtn);
 actions.appendChild(downBtn);
 actions.appendChild(editBtn);
 actions.appendChild(deleteBtn);
 item.appendChild(text);
 item.appendChild(actions);
 container.appendChild(item);
 });
 },

 editOption(fieldName, oldValue) {
 var newValue = prompt('修改选项名称：', oldValue);
 if (newValue === null) { return; }
 newValue = newValue.trim();
 if (!newValue) {
 Toast.show('选项名称不能为空', 'error');
 return;
 }
 if (newValue === oldValue) { return; }
 var existing = OptionController.getOptions(fieldName);
 if (existing.indexOf(newValue) !== -1) {
 Toast.show('选项已存在', 'error');
 return;
 }
 OptionController.updateOption(fieldName, oldValue, newValue);
 Toast.show('选项已更新', 'success');
 this.renderList();
 },

 deleteOption(fieldName, value) {
 if (!confirm('确定要删除选项"' + value + '"吗？')) { return; }
 OptionController.removeOption(fieldName, value);
 Toast.show('选项已删除', 'success');
 this.renderList();
 }
};

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

/* ========== PatternController 模块 ========== */
const PatternController = {
 editingId: null,
 imageBase64: '',
 imageKey: '',

 init() {
 var self = this;
 document.getElementById('btnAddPattern').addEventListener('click', function() { self.openForm(); });
 document.getElementById('btnCancelPattern').addEventListener('click', function() { self.closeForm(); });
 document.getElementById('btnSaveCopyPattern').addEventListener('click', function() { self.handleSubmit(true); });
 document.getElementById('patternForm').addEventListener('submit', function(e) { e.preventDefault(); self.handleSubmit(false); });
 document.getElementById('patternFormImageInput').addEventListener('change', function(e) { self.handleImageUpload(e); });
 document.getElementById('patternFormImageRemove').addEventListener('click', function() { self.removeImage(); });

 document.getElementById('patternForm').addEventListener('paste', function(e) {
 var items = (e.clipboardData || e.originalEvent.clipboardData).items;
 for (var i = 0; i < items.length; i++) {
 if (items[i].type.indexOf('image') !== -1) {
 e.preventDefault();
 var blob = items[i].getAsFile();
 var reader = new FileReader();
 reader.onload = function(ev) {
 guardImageUpload(function() {
 PatternController.imageBase64 = ev.target.result;
 var imageKey = 'img_' + generateUUID();
 ImageStore.save(imageKey, ev.target.result);
 PatternController.imageKey = 'idb:' + imageKey;
 document.getElementById('patternFormImageThumb').src = ev.target.result;
 document.getElementById('patternFormImagePreview').style.display = 'block';
 });
 };
 reader.readAsDataURL(blob);
 break;
 }
 }
 });

 document.getElementById('patternViewToggle').addEventListener('click', function(e) {
 var btn = e.target.closest('.view-toggle-btn');
 if (!btn) return;
 var mode = btn.getAttribute('data-mode');
 ViewToggle.setMode('pattern', mode);
 document.querySelectorAll('#patternViewToggle .view-toggle-btn').forEach(function(b) {
 b.classList.toggle('active', b.getAttribute('data-mode') === mode);
 });
 document.getElementById('patternExpandBtns').style.display = (mode === 'card') ? '' : 'none';
 self.renderList();
 });

 this.renderList();
 Router.onNavigate(function(page) {
 if (page === 'pattern') { PageFilter._rendered_pattern = false; self.renderList(); }
 });
 },

 populateOptions(selectId, optionField, selectedValue) {
 var select = document.getElementById(selectId);
 var options = OptionController.getOptions(optionField);
 var placeholder = select.options[0] ? select.options[0].textContent : '请选择';
 select.innerHTML = '<option value="">' + placeholder + '</option>';
 options.forEach(function(opt) {
 var o = document.createElement('option');
 o.value = opt; o.textContent = opt;
 if (opt === selectedValue) o.selected = true;
 select.appendChild(o);
 });
 var addOpt = document.createElement('option');
 addOpt.value = '__add_new__'; addOpt.textContent = '+ 新增选项...';
 select.appendChild(addOpt);
 select.onchange = function() {
 if (select.value === '__add_new__') {
 var newVal = prompt('请输入新选项：');
 if (newVal && newVal.trim()) {
 OptionController.addOption(optionField, newVal.trim());
 PatternController.populateOptions(selectId, optionField, newVal.trim());
 } else { select.value = selectedValue || ''; }
 }
 };
 },

 handleImageUpload(e) {
 var self = this; var file = e.target.files[0];
 if (!file) return;
 if (!file.type.startsWith('image/')) { Toast.show('请选择图片文件', 'error'); return; }
 var reader = new FileReader();
 reader.onload = function(ev) {
 guardImageUpload(function() {
 self.imageBase64 = ev.target.result;
 var imageKey = 'img_' + generateUUID();
 ImageStore.save(imageKey, ev.target.result);
 self.imageKey = 'idb:' + imageKey;
 document.getElementById('patternFormImageThumb').src = self.imageBase64;
 document.getElementById('patternFormImagePreview').style.display = 'block';
 });
 };
 reader.readAsDataURL(file);
 },

 removeImage() {
 this.imageBase64 = ''; this.imageKey = '';
 document.getElementById('patternFormImageThumb').src = '';
 document.getElementById('patternFormImagePreview').style.display = 'none';
 document.getElementById('patternFormImageInput').value = '';
 },

 openForm(id) {
 var self = this;
 this.editingId = id || null;
 this.clearFormErrors();
 this.populateOptions('patternFormBrand', 'patternBrand', '');
 this.populateOptions('patternFormCategory', 'patternCategory', '');

 if (id) {
 var p = Store.getById(Store.KEYS.PATTERNS, id);
 if (!p) return;
 document.getElementById('patternFormTitle').textContent = '编辑纸样';
 document.getElementById('patternEditId').value = id;
 document.getElementById('patternFormName').value = p.name || '';
 this.populateOptions('patternFormBrand', 'patternBrand', p.brand || '');
 document.getElementById('patternFormCode').value = p.code || '';
 this.populateOptions('patternFormCategory', 'patternCategory', p.category || '');
 document.getElementById('patternFormLink').value = p.link || '';
 document.getElementById('patternFormNote').value = p.note || '';
 if (p.image) {
 if (p.image.startsWith('idb:')) {
 self.imageKey = p.image;
 ImageStore.get(p.image.substring(4)).then(function(data) {
 if (data) { self.imageBase64 = data; document.getElementById('patternFormImageThumb').src = data; document.getElementById('patternFormImagePreview').style.display = 'block'; }
 });
 } else { self.imageBase64 = p.image; document.getElementById('patternFormImageThumb').src = p.image; document.getElementById('patternFormImagePreview').style.display = 'block'; }
 } else { this.removeImage(); }
 } else {
 document.getElementById('patternFormTitle').textContent = '添加纸样';
 document.getElementById('patternEditId').value = '';
 document.getElementById('patternForm').reset();
 this.removeImage();
 }
 document.getElementById('patternFormOverlay').classList.add('show');
 },

 closeForm() { document.getElementById('patternFormOverlay').classList.remove('show'); this.editingId = null; },

 clearFormErrors() { document.querySelectorAll('#patternForm .form-group').forEach(function(g) { g.classList.remove('has-error'); }); },

 handleSubmit(copyAfter) {
 var data = {
 name: document.getElementById('patternFormName').value.trim(),
 brand: document.getElementById('patternFormBrand').value === '__add_new__' ? '' : document.getElementById('patternFormBrand').value,
 code: document.getElementById('patternFormCode').value.trim(),
 category: document.getElementById('patternFormCategory').value === '__add_new__' ? '' : document.getElementById('patternFormCategory').value,
 link: document.getElementById('patternFormLink').value.trim(),
 note: document.getElementById('patternFormNote').value.trim(),
 image: this.imageKey || this.imageBase64
 };
 if (!data.name) {
 document.getElementById('patternFormNameError').textContent = '纸样名称不能为空';
 document.getElementById('patternFormNameError').parentElement.classList.add('has-error');
 Toast.show('请检查表单填写', 'error'); return;
 }
 if (this.editingId) { Store.update(Store.KEYS.PATTERNS, this.editingId, data); Toast.show('纸样更新成功', 'success'); }
 else { Store.add(Store.KEYS.PATTERNS, data); Toast.show('纸样添加成功', 'success'); }
 this.closeForm(); this.renderList();
 if (copyAfter) {
 var saved = JSON.parse(JSON.stringify(data));
 var self = this;
 setTimeout(function() {
 self.openForm();
 document.getElementById('patternFormName').value = saved.name;
 self.populateOptions('patternFormBrand', 'patternBrand', saved.brand);
 document.getElementById('patternFormCode').value = saved.code;
 self.populateOptions('patternFormCategory', 'patternCategory', saved.category);
 document.getElementById('patternFormLink').value = saved.link;
 document.getElementById('patternFormNote').value = saved.note;
 if (saved.image) { self.imageKey = saved.image; if (saved.image.startsWith('idb:')) { ImageStore.get(saved.image.substring(4)).then(function(d) { if(d){self.imageBase64=d;document.getElementById('patternFormImageThumb').src=d;document.getElementById('patternFormImagePreview').style.display='block';} }); } }
 }, 100);
 }
 },

 deletePattern(id) {
 DeleteConfirm.show('确定要删除这条纸样记录吗？此操作不可撤销。', function() {
 Store.remove(Store.KEYS.PATTERNS, id); Toast.show('纸样已删除', 'success'); PatternController.renderList();
 });
 },

 renderList() {
 var self = this;
 var patterns = Store.getAll(Store.KEYS.PATTERNS);
 var products = Store.getAll(Store.KEYS.PRODUCTS);
 var container = document.getElementById('patternList');
 var mode = ViewToggle.getMode('pattern');

 if (!PageFilter._rendered_pattern) { PageFilter.renderBar('pattern'); PageFilter._rendered_pattern = true; }
 patterns = patterns.filter(function(p) { return PageFilter.matchItem('pattern', p); });

 if (patterns.length === 0) {
 container.className = 'fabric-list';
 container.innerHTML = '<div class="fabric-empty">还没有纸样记录，点击上方按钮添加吧！</div>';
 return;
 }

 if (mode === 'list') {
 var html = '<div class="list-table-wrapper"><div class="list-table">';
 html += '<div class="list-table-header"><span class="lt-col lt-col-name">名称</span><span class="lt-col lt-col-shop">来源</span><span class="lt-col lt-col-category">编号</span><span class="lt-col lt-col-category">类别</span><span class="lt-col lt-col-actions">操作</span></div>';
 patterns.forEach(function(p) {
 html += '<div class="list-table-row">';
 html += '<span class="lt-col lt-col-name">' + self.escapeHtml(p.name) + '</span>';
 html += '<span class="lt-col lt-col-shop">' + self.escapeHtml(p.brand || '-') + '</span>';
 html += '<span class="lt-col lt-col-category">' + self.escapeHtml(p.code || '-') + '</span>';
 html += '<span class="lt-col lt-col-category">' + self.escapeHtml(p.category || '-') + '</span>';
 html += '<span class="lt-col lt-col-actions"><button class="btn btn-icon" style="color:var(--teal)" onclick="PatternController.openForm(\'' + p.id + '\')" title="编辑">' + svgIcon('edit') + '</button> <button class="btn btn-icon btn-danger" onclick="PatternController.deletePattern(\'' + p.id + '\')" title="删除">' + svgIcon('trash') + '</button></span>';
 html += '</div>';
 });
 html += '</div></div>';
 container.innerHTML = html; container.className = ''; return;
 }

 container.className = 'fabric-list';
 var html = '';
 patterns.forEach(function(p) {
 html += '<div class="fabric-card" style="border-top:none;">';
 /* 图片区域 */
 if (p.image) { html += '<img id="ptimg_' + p.id + '" class="fabric-card-image" alt="">'; }
 else { html += '<div class="fabric-card-image-placeholder" style="background:linear-gradient(135deg,#E0F0ED,#ECF5F3);"></div>'; }
 /* 信息区域 */
 html += '<div class="fabric-card-info">';
 html += '<div class="fabric-card-header"><span class="fabric-card-name">' + self.escapeHtml(p.name) + '</span>';
 html += '<div class="fabric-card-actions"><button class="btn btn-icon" style="color:var(--teal)" onclick="PatternController.openForm(\'' + p.id + '\')" title="编辑">' + svgIcon('edit') + '</button>';
 html += '<button class="btn btn-icon btn-danger" onclick="PatternController.deletePattern(\'' + p.id + '\')" title="删除">' + svgIcon('trash') + '</button></div></div>';
 html += '<div class="fabric-card-body">';
 if (p.brand) html += '<div class="fabric-card-row"><span class="fabric-card-label">来源</span><span class="fabric-card-value">' + self.escapeHtml(p.brand) + '</span></div>';
 if (p.code) html += '<div class="fabric-card-row"><span class="fabric-card-label">编号</span><span class="fabric-card-value">' + self.escapeHtml(p.code) + '</span></div>';
 if (p.category) html += '<div class="fabric-card-row"><span class="fabric-card-label">类别</span><span class="fabric-card-value">' + self.escapeHtml(p.category) + '</span></div>';
 html += '</div>';
 html += '</div></div>';
 });
 container.innerHTML = html;
 patterns.forEach(function(p) { if (p.image) { var el = document.getElementById('ptimg_' + p.id); if (el) loadIdbImage(el, p.image); } });
 },

 escapeHtml(str) { if (!str) return ''; var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
};


/* ========== NotionController 模块 ========== */
const NotionController = {
 editingId: null,
 imageBase64: '',
 imageKey: '',

 init() {
 var self = this;
 document.getElementById('btnAddNotion').addEventListener('click', function() { self.openForm(); });
 document.getElementById('btnCancelNotion').addEventListener('click', function() { self.closeForm(); });
 document.getElementById('btnSaveCopyNotion').addEventListener('click', function() { self.handleSubmit(true); });
 document.getElementById('notionForm').addEventListener('submit', function(e) { e.preventDefault(); self.handleSubmit(false); });
 document.getElementById('notionFormImageInput').addEventListener('change', function(e) { self.handleImageUpload(e); });
 document.getElementById('notionFormImageRemove').addEventListener('click', function() { self.removeImage(); });

 document.getElementById('notionForm').addEventListener('paste', function(e) {
 var items = (e.clipboardData || e.originalEvent.clipboardData).items;
 for (var i = 0; i < items.length; i++) {
 if (items[i].type.indexOf('image') !== -1) {
 e.preventDefault();
 var blob = items[i].getAsFile();
 var reader = new FileReader();
 reader.onload = function(ev) {
 guardImageUpload(function() {
 NotionController.imageBase64 = ev.target.result;
 var imageKey = 'img_' + generateUUID();
 ImageStore.save(imageKey, ev.target.result);
 NotionController.imageKey = 'idb:' + imageKey;
 document.getElementById('notionFormImageThumb').src = ev.target.result;
 document.getElementById('notionFormImagePreview').style.display = 'block';
 });
 };
 reader.readAsDataURL(blob);
 break;
 }
 }
 });

 document.getElementById('notionViewToggle').addEventListener('click', function(e) {
 var btn = e.target.closest('.view-toggle-btn');
 if (!btn) return;
 var mode = btn.getAttribute('data-mode');
 ViewToggle.setMode('notion', mode);
 document.querySelectorAll('#notionViewToggle .view-toggle-btn').forEach(function(b) {
 b.classList.toggle('active', b.getAttribute('data-mode') === mode);
 });
 document.getElementById('notionExpandBtns').style.display = (mode === 'card') ? '' : 'none';
 self.renderList();
 });

 this.renderList();
 Router.onNavigate(function(page) {
 if (page === 'notion') { PageFilter._rendered_notion = false; self.renderList(); }
 });
 },

 populateOptions(selectId, optionField, selectedValue) {
 var select = document.getElementById(selectId);
 var options = OptionController.getOptions(optionField);
 var placeholder = select.options[0] ? select.options[0].textContent : '请选择';
 select.innerHTML = '<option value="">' + placeholder + '</option>';
 options.forEach(function(opt) {
 var o = document.createElement('option');
 o.value = opt; o.textContent = opt;
 if (opt === selectedValue) o.selected = true;
 select.appendChild(o);
 });
 var addOpt = document.createElement('option');
 addOpt.value = '__add_new__'; addOpt.textContent = '+ 新增选项...';
 select.appendChild(addOpt);
 select.onchange = function() {
 if (select.value === '__add_new__') {
 var newVal = prompt('请输入新选项：');
 if (newVal && newVal.trim()) {
 OptionController.addOption(optionField, newVal.trim());
 NotionController.populateOptions(selectId, optionField, newVal.trim());
 } else { select.value = selectedValue || ''; }
 }
 };
 },

 handleImageUpload(e) {
 var self = this; var file = e.target.files[0];
 if (!file) return;
 if (!file.type.startsWith('image/')) { Toast.show('请选择图片文件', 'error'); return; }
 var reader = new FileReader();
 reader.onload = function(ev) {
 guardImageUpload(function() {
 self.imageBase64 = ev.target.result;
 var imageKey = 'img_' + generateUUID();
 ImageStore.save(imageKey, ev.target.result);
 self.imageKey = 'idb:' + imageKey;
 document.getElementById('notionFormImageThumb').src = self.imageBase64;
 document.getElementById('notionFormImagePreview').style.display = 'block';
 });
 };
 reader.readAsDataURL(file);
 },

 removeImage() {
 this.imageBase64 = ''; this.imageKey = '';
 document.getElementById('notionFormImageThumb').src = '';
 document.getElementById('notionFormImagePreview').style.display = 'none';
 document.getElementById('notionFormImageInput').value = '';
 },

 openForm(id) {
 var self = this;
 this.editingId = id || null;
 this.clearFormErrors();
 this.populateOptions('notionFormCategory', 'notionCategory', '');
 this.populateOptions('notionFormShop', 'notionShop', '');
 this.populateOptions('notionFormUnit', 'notionUnit', '');

 if (id) {
 var n = Store.getById(Store.KEYS.NOTIONS, id);
 if (!n) return;
 document.getElementById('notionFormTitle').textContent = '编辑辅料';
 document.getElementById('notionEditId').value = id;
 document.getElementById('notionFormName').value = n.name || '';
 this.populateOptions('notionFormCategory', 'notionCategory', n.category || '');
 this.populateOptions('notionFormShop', 'notionShop', n.shop || '');
 document.getElementById('notionFormQuantity').value = n.quantity || '';
 this.populateOptions('notionFormUnit', 'notionUnit', n.unit || '');
 document.getElementById('notionFormPrice').value = n.price || '';
 document.getElementById('notionFormDate').value = n.purchaseDate || '';
 if (n.image) {
 if (n.image.startsWith('idb:')) {
 self.imageKey = n.image;
 ImageStore.get(n.image.substring(4)).then(function(data) {
 if (data) { self.imageBase64 = data; document.getElementById('notionFormImageThumb').src = data; document.getElementById('notionFormImagePreview').style.display = 'block'; }
 });
 } else { self.imageBase64 = n.image; document.getElementById('notionFormImageThumb').src = n.image; document.getElementById('notionFormImagePreview').style.display = 'block'; }
 } else { this.removeImage(); }
 } else {
 document.getElementById('notionFormTitle').textContent = '添加辅料';
 document.getElementById('notionEditId').value = '';
 document.getElementById('notionForm').reset();
 document.getElementById('notionFormDate').value = new Date().toISOString().split('T')[0];
 this.removeImage();
 }
 document.getElementById('notionFormOverlay').classList.add('show');
 },

 closeForm() { document.getElementById('notionFormOverlay').classList.remove('show'); this.editingId = null; },

 clearFormErrors() { document.querySelectorAll('#notionForm .form-group').forEach(function(g) { g.classList.remove('has-error'); }); },

 handleSubmit(copyAfter) {
 var data = {
 name: document.getElementById('notionFormName').value.trim(),
 category: document.getElementById('notionFormCategory').value === '__add_new__' ? '' : document.getElementById('notionFormCategory').value,
 shop: document.getElementById('notionFormShop').value === '__add_new__' ? '' : document.getElementById('notionFormShop').value,
 quantity: parseFloat(document.getElementById('notionFormQuantity').value) || '',
 unit: document.getElementById('notionFormUnit').value === '__add_new__' ? '' : document.getElementById('notionFormUnit').value,
 price: parseFloat(document.getElementById('notionFormPrice').value) || '',
 purchaseDate: document.getElementById('notionFormDate').value,
 image: this.imageKey || this.imageBase64
 };
 var errors = {};
 if (!data.name) errors.name = true;
 if (!data.quantity && data.quantity !== 0) errors.quantity = true;
 if (!data.price && data.price !== 0) errors.price = true;
 if (!data.purchaseDate) errors.date = true;
 if (Object.keys(errors).length > 0) {
 if (errors.name) { document.getElementById('notionFormNameError').textContent = '辅料名称不能为空'; document.getElementById('notionFormNameError').parentElement.classList.add('has-error'); }
 if (errors.quantity) { document.getElementById('notionFormQuantityError').textContent = '数量不能为空'; document.getElementById('notionFormQuantityError').parentElement.classList.add('has-error'); }
 if (errors.price) { document.getElementById('notionFormPriceError').textContent = '价格不能为空'; document.getElementById('notionFormPriceError').parentElement.classList.add('has-error'); }
 if (errors.date) { document.getElementById('notionFormDateError').textContent = '购买日期不能为空'; document.getElementById('notionFormDateError').parentElement.classList.add('has-error'); }
 Toast.show('请检查表单填写', 'error'); return;
 }
 if (this.editingId) { Store.update(Store.KEYS.NOTIONS, this.editingId, data); Toast.show('辅料更新成功', 'success'); }
 else { Store.add(Store.KEYS.NOTIONS, data); Toast.show('辅料添加成功', 'success'); }
 this.closeForm(); this.renderList();
 if (copyAfter) {
 var saved = JSON.parse(JSON.stringify(data));
 var self = this;
 setTimeout(function() {
 self.openForm();
 document.getElementById('notionFormName').value = saved.name;
 self.populateOptions('notionFormCategory', 'notionCategory', saved.category);
 self.populateOptions('notionFormShop', 'notionShop', saved.shop);
 document.getElementById('notionFormQuantity').value = saved.quantity;
 self.populateOptions('notionFormUnit', 'notionUnit', saved.unit);
 document.getElementById('notionFormPrice').value = saved.price;
 document.getElementById('notionFormDate').value = saved.purchaseDate;
 if (saved.image) { self.imageKey = saved.image; if (saved.image.startsWith('idb:')) { ImageStore.get(saved.image.substring(4)).then(function(d) { if(d){self.imageBase64=d;document.getElementById('notionFormImageThumb').src=d;document.getElementById('notionFormImagePreview').style.display='block';} }); } }
 }, 100);
 }
 },

 deleteNotion(id) {
 DeleteConfirm.show('确定要删除这条辅料记录吗？此操作不可撤销。', function() {
 Store.remove(Store.KEYS.NOTIONS, id); Toast.show('辅料已删除', 'success'); NotionController.renderList();
 });
 },

 addQuantity(id) {
 var n = Store.getById(Store.KEYS.NOTIONS, id);
 if (!n) return;
 var input = prompt('追加数量（累加到「' + n.name + '」的库存，当前 ' + (n.quantity || 0) + (n.unit ? ' ' + n.unit : '') + '）', '');
 if (input === null) return;
 var add = Number(input);
 if (!isFinite(add) || add <= 0) { Toast.show('请输入大于 0 的数字', 'error'); return; }
 var newQty = Math.round((Number(n.quantity || 0) + add) * 100) / 100;
 Store.update(Store.KEYS.NOTIONS, id, { quantity: newQty });
 Toast.show('已追加 ' + add + (n.unit ? ' ' + n.unit : '') + '，库存 ' + newQty, 'success');
 NotionController.renderList();
 },

 renderList() {
 var self = this;
 var notions = Store.getAll(Store.KEYS.NOTIONS);
 var container = document.getElementById('notionList');
 var mode = ViewToggle.getMode('notion');

 notions.sort(function(a, b) { return (b.purchaseDate || '').localeCompare(a.purchaseDate || ''); });

 if (!PageFilter._rendered_notion) { PageFilter.renderBar('notion'); PageFilter._rendered_notion = true; }
 notions = notions.filter(function(n) { return PageFilter.matchItem('notion', n); });

 if (notions.length === 0) {
 container.className = 'fabric-list';
 container.innerHTML = '<div class="fabric-empty">还没有辅料记录，点击上方按钮添加吧！</div>';
 return;
 }

 if (mode === 'list') {
 var html = '<div class="list-table-wrapper"><div class="list-table">';
 html += '<div class="list-table-header"><span class="lt-col lt-col-name">名称</span><span class="lt-col lt-col-category">类别</span><span class="lt-col lt-col-shop">店铺</span><span class="lt-col lt-col-meters">数量</span><span class="lt-col lt-col-price">价格</span><span class="lt-col lt-col-date">日期</span><span class="lt-col lt-col-actions">操作</span></div>';
 notions.forEach(function(n) {
 html += '<div class="list-table-row">';
 html += '<span class="lt-col lt-col-name">' + self.escapeHtml(n.name) + '</span>';
 html += '<span class="lt-col lt-col-category">' + self.escapeHtml(n.category || '-') + '</span>';
 html += '<span class="lt-col lt-col-shop">' + self.escapeHtml(n.shop || '-') + '</span>';
 html += '<span class="lt-col lt-col-meters">' + (n.quantity || '-') + (n.unit ? ' ' + n.unit : '') + '</span>';
 html += '<span class="lt-col lt-col-price">¥' + n.price + '</span>';
 html += '<span class="lt-col lt-col-date">' + self.escapeHtml(n.purchaseDate || '-') + '</span>';
 html += '<span class="lt-col lt-col-actions"><button class="btn btn-icon" style="color:var(--green-dark)" onclick="NotionController.addQuantity(\'' + n.id + '\')" title="追加数量">' + svgIcon('plus') + '</button> <button class="btn btn-icon" style="color:var(--amber)" onclick="NotionController.openForm(\'' + n.id + '\')" title="编辑">' + svgIcon('edit') + '</button> <button class="btn btn-icon btn-danger" onclick="NotionController.deleteNotion(\'' + n.id + '\')" title="删除">' + svgIcon('trash') + '</button></span>';
 html += '</div>';
 });
 html += '</div></div>';
 container.innerHTML = html; container.className = ''; return;
 }

 container.className = 'fabric-list';
 var html = '';
 notions.forEach(function(n) {
 html += '<div class="fabric-card" style="border-top:none;">';
 /* 图片区域 */
 if (n.image) { html += '<img id="ntimg_' + n.id + '" class="fabric-card-image" alt="">'; }
 else { html += '<div class="fabric-card-image-placeholder" style="background:linear-gradient(135deg,#F5EFD8,#F0ECE0);"></div>'; }
 /* 信息区域 */
 html += '<div class="fabric-card-info">';
 html += '<div class="fabric-card-header"><span class="fabric-card-name">' + self.escapeHtml(n.name) + '</span>';
 html += '<div class="fabric-card-actions"><button class="btn btn-icon" style="color:var(--green-dark)" onclick="NotionController.addQuantity(\'' + n.id + '\')" title="追加数量">' + svgIcon('plus') + '</button><button class="btn btn-icon" style="color:var(--amber)" onclick="NotionController.openForm(\'' + n.id + '\')" title="编辑">' + svgIcon('edit') + '</button>';
 html += '<button class="btn btn-icon btn-danger" onclick="NotionController.deleteNotion(\'' + n.id + '\')" title="删除">' + svgIcon('trash') + '</button></div></div>';
 html += '<div class="fabric-card-body">';
 if (n.category) html += '<div class="fabric-card-row"><span class="fabric-card-label">类别</span><span class="fabric-card-value">' + self.escapeHtml(n.category) + '</span></div>';
 html += '<div class="fabric-card-row"><span class="fabric-card-label">数量</span><span class="fabric-card-value">' + (n.quantity || '-') + (n.unit ? ' ' + n.unit : '') + '</span></div>';
 html += '<div class="fabric-card-row"><span class="fabric-card-label">价格</span><span class="fabric-card-value">¥' + n.price + '</span></div>';
 html += '</div>';
 html += '</div></div>';
 });
 container.innerHTML = html;
 notions.forEach(function(n) { if (n.image) { var el = document.getElementById('ntimg_' + n.id); if (el) loadIdbImage(el, n.image); } });
 },

 escapeHtml(str) { if (!str) return ''; var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
};


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

/* ========== CommunityController 社区（任务 12/13/14） ========== */
const CommunityController = {
 currentTab: 'feed',
 _bound: false,

 init() {
 var self = this;
 var tabs = document.getElementById('communityTabs');
 if (tabs && !this._bound) {
 tabs.addEventListener('click', function(e) {
 var btn = e.target.closest('.community-tab');
 if (!btn) return;
 var tab = btn.getAttribute('data-tab');
 self.switchTab(tab);
 });
 this._bound = true;
 }
 Router.onNavigate(function(page) {
 if (page === 'community') self.render();
 });
 },

 switchTab(tab) {
 this.currentTab = tab;
 document.querySelectorAll('#communityTabs .community-tab').forEach(function(b) {
 b.classList.toggle('active', b.getAttribute('data-tab') === tab);
 });
 this.render();
 },

 render() {
 var container = document.getElementById('communityContent');
 if (!container) return;
 container.innerHTML = '<div class="community-empty">加载中...</div>';
 var self = this;
 var loader = this.currentTab === 'mine' ? CommunityStore.getMyPosts()
 : this.currentTab === 'fav' ? CommunityStore.getMyFavorites()
 : CommunityStore.getFeed(0, 30);
 loader.then(function(posts) { self.renderCards(posts, container); });
 },

 renderCards(posts, container) {
 var self = this;
 if (!posts || !posts.length) {
 var msg = this.currentTab === 'mine' ? '还没有发布作品。去"制品管理"点发布按钮发布第一个作品吧～'
 : this.currentTab === 'fav' ? '还没有收藏任何作品。'
 : '还没有公开作品，快来发布第一个！';
 container.innerHTML = '<div class="community-empty">' + msg + '</div>';
 return;
 }
 var html = '<div class="community-feed">';
 posts.forEach(function(p) {
 html += '<div class="post-card" onclick="CommunityController.openDetail(\'' + p.id + '\')">';
 if (p.image_url) {
 html += '<img class="post-card-img" src="' + self.escapeAttr(p.image_url) + '" alt="">';
 } else {
 html += '<div class="post-card-img-ph"></div>';
 }
 html += '<div class="post-card-body">';
 html += '<div class="post-card-title">' + self.escapeHtml(p.title || '未命名') + '</div>';
 html += '<div class="post-card-meta"><span>❤ ' + (p.like_count || 0) + '</span><span>⭐ ' + (p.favorite_count || 0) + '</span>';
 if (self.currentTab === 'mine' && !p.is_public) html += '<span style="color:var(--coral);">已隐藏</span>';
 html += '</div>';
 html += '</div></div>';
 });
 html += '</div>';
 container.innerHTML = html;
 },

 openDetail(postId) {
 var self = this;
 CommunityStore.getPostDetail(postId).then(function(post) {
 if (!post) { Toast.show('作品不存在或已删除', 'error'); return; }
 self._renderDetail(post);
 });
 },

 _renderDetail(post) {
 var self = this;
 var old = document.getElementById('postDetailOverlay');
 if (old) old.parentNode.removeChild(old);

 var isOwner = window.Auth && Auth.currentUser && Auth.currentUser.id === post.user_id;

 var info = '';
 // 社区仅展示最终成本，不显示布料/辅料明细
 if (post.pattern_snapshot && post.pattern_snapshot.name) {
 var pat = post.pattern_snapshot;
 info += '<div class="post-detail-info-row"><span>纸样</span><span>' + self.escapeHtml(pat.name) + (pat.brand ? ' / ' + self.escapeHtml(pat.brand) : '') + '</span></div>';
 }
 if (post.show_cost && post.cost_snapshot) {
 info += '<div class="post-detail-info-row"><span>成本</span><span>¥' + (post.cost_snapshot.total || 0) + '</span></div>';
 }
 if (post.category) {
 info += '<div class="post-detail-info-row"><span>分类</span><span>' + self.escapeHtml(post.category) + '</span></div>';
 }

 var ownerBtns = isOwner
 ? '<div style="display:flex;gap:10px;margin-top:12px;">' +
 '<button class="btn btn-gray btn-sm" onclick="CommunityController.updateMyPost(\'' + post.id + '\')">更新快照</button>' +
 '<button class="btn btn-gray btn-sm" onclick="CommunityController.togglePublic(\'' + post.id + '\',' + (post.is_public ? 'false' : 'true') + ')">' + (post.is_public ? '取消公开' : '重新公开') + '</button>' +
 '<button class="btn btn-danger btn-sm" onclick="CommunityController.deleteMyPost(\'' + post.id + '\')">删除</button></div>'
 : '';

 var overlay = document.createElement('div');
 overlay.id = 'postDetailOverlay';
 overlay.className = 'post-detail-overlay';
 var box = document.createElement('div');
 box.className = 'post-detail-box';
 var imgHtml = post.image_url ? '<img class="post-detail-img" src="' + self.escapeAttr(post.image_url) + '" alt="">' : '';
 box.innerHTML = imgHtml +
 '<div class="post-detail-content">' +
 '<div style="font-size:19px;font-weight:700;color:var(--text);margin-bottom:6px;">' + self.escapeHtml(post.title || '未命名') + '</div>' +
 (post.description ? '<div style="font-size:13.5px;color:var(--text-light);line-height:1.7;margin-bottom:14px;">' + self.escapeHtml(post.description) + '</div>' : '') +
 info +
 '<div class="post-detail-actions">' +
 '<button class="post-action-btn' + (post._liked ? ' active' : '') + '" id="pdLike">❤ 点赞 <span id="pdLikeCount">' + (post.like_count || 0) + '</span></button>' +
 '<button class="post-action-btn' + (post._favorited ? ' active' : '') + '" id="pdFav">⭐ 收藏 <span id="pdFavCount">' + (post.favorite_count || 0) + '</span></button>' +
 '</div>' + ownerBtns +
 '<button class="btn btn-gray" style="width:100%;margin-top:14px;" id="pdClose">关闭</button>' +
 '</div>';
 overlay.appendChild(box);
 document.body.appendChild(overlay);

 function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
 overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
 document.getElementById('pdClose').addEventListener('click', close);

 document.getElementById('pdLike').addEventListener('click', function() {
 var btn = this;
 CommunityStore.toggleLike(post.id).then(function(r) {
 if (r && r.needLogin) { Toast.show('请先登录', 'error'); return; }
 btn.classList.toggle('active', r.liked);
 document.getElementById('pdLikeCount').textContent = r.likeCount;
 });
 });
 document.getElementById('pdFav').addEventListener('click', function() {
 var btn = this;
 CommunityStore.toggleFavorite(post.id).then(function(r) {
 if (r && r.needLogin) { Toast.show('请先登录', 'error'); return; }
 btn.classList.toggle('active', r.favorited);
 document.getElementById('pdFavCount').textContent = r.favoriteCount;
 });
 });
 },

 updateMyPost(postId) {
 CommunityStore.updatePost(postId, {}).then(function(res) {
 if (res && res.ok) { Toast.show('作品已按最新制品更新', 'success'); }
 else { Toast.show('更新失败：' + ((res && res.error) || ''), 'error'); }
 });
 },

 togglePublic(postId, makePublic) {
 var self = this;
 CommunityStore.setPublic(postId, makePublic).then(function(ok) {
 if (ok) {
 Toast.show(makePublic ? '已重新公开' : '已取消公开', 'success');
 var o = document.getElementById('postDetailOverlay'); if (o) o.remove();
 self.render();
 } else {
 Toast.show('操作失败', 'error');
 }
 });
 },

 deleteMyPost(postId) {
 var self = this;
 DeleteConfirm.show('确定删除这个作品吗？点赞收藏也会一并移除，此操作不可撤销。', function() {
 CommunityStore.deletePost(postId).then(function(ok) {
 if (ok) { Toast.show('作品已删除', 'success'); var o=document.getElementById('postDetailOverlay'); if(o)o.remove(); self.render(); }
 });
 });
 },

 escapeHtml(str) { if (str == null) return ''; var d = document.createElement('div'); d.textContent = String(str); return d.innerHTML; },
 escapeAttr(str) { return this.escapeHtml(str).replace(/"/g, '&quot;'); }
};

/* ========== 初始化 ========== */
document.addEventListener('DOMContentLoaded', function() {
ImageStore.init().then(function() {
 OptionController._ensureInitialized();
 migrateImagesToIDB();
 Router.init();

 // 顶部栏标题联动
 var topbarTitleMap = { home: '主页', fabric: '布料管理', product: '制品管理', pattern: '纸样管理', notion: '辅料管理', todo: '待做列表', dashboard: '看板', print: '打印' };
 Router.onNavigate(function(page) {
   var el = document.getElementById('topbarTitle');
   if (el) el.textContent = topbarTitleMap[page] || '主页';
 });

 DeleteConfirm.init();
 HomeController.init();
 FabricController.init();
 ProductController.init();
 PatternController.init();
 NotionController.init();
 TodoController.init();
 DashboardController.init();
 PrintController.init();
 DataController.init();
 OptionManagerController.init();
 CardExpandState.init();
 CommunityController.init();

 // 手机端菜单切换
 var mobileMenuBtn = document.getElementById('mobileMenuBtn');
 var sidebar = document.getElementById('sidebar');
 var sidebarOverlay = document.getElementById('sidebarOverlay');
 if (mobileMenuBtn) {
   mobileMenuBtn.addEventListener('click', function() {
     sidebar.classList.toggle('open');
     sidebarOverlay.classList.toggle('show');
   });
   sidebarOverlay.addEventListener('click', function() {
     sidebar.classList.remove('open');
     sidebarOverlay.classList.remove('show');
   });
   // 点击导航链接后自动关闭侧边栏
   sidebar.querySelectorAll('.sidebar-nav a').forEach(function(link) {
     link.addEventListener('click', function() {
       if (window.innerWidth <= 768) {
         sidebar.classList.remove('open');
         sidebarOverlay.classList.remove('show');
       }
     });
   });
 }
 });
});

