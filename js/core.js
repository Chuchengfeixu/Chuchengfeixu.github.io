

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

