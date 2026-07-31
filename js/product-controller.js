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
 document.getElementById('btnAddNotionUsage').addEventListener('click', function() {
 self.addNotionUsageRow();
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
 select.value = selectedValue || '';
 InputDialog.open({ title: '新增类别', placeholder: '请输入新的类别名称' }).then(function(newVal) {
 if (newVal && newVal.trim()) {
 OptionController.addOption('productCategory', newVal.trim());
 ProductController.populateCategoryOptions(newVal.trim());
 }
 });
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
 select.value = selectedValue || '';
 InputDialog.open({ title: '新增使用者', placeholder: '请输入新的使用者名称' }).then(function(newVal) {
 if (newVal && newVal.trim()) {
 OptionController.addOption('productUser', newVal.trim());
 ProductController.populateUserOptions(newVal.trim());
 }
 });
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
select.value = selectedValue || '';
InputDialog.open({ title: '新增纸样来源', placeholder: '请输入新的纸样来源' }).then(function(newVal) {
if (newVal && newVal.trim()) {
OptionController.addOption('patternBrand', newVal.trim());
ProductController.populatePatternSourceOptions(newVal.trim());
}
});
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

addNotionUsageRow(notionId, quantityUsed) {
var container = document.getElementById('notionUsageRows');
var notions = Store.getAll(Store.KEYS.NOTIONS);
var products = Store.getAll(Store.KEYS.PRODUCTS);

var row = document.createElement('div');
row.className = 'fabric-usage-row';

var select = document.createElement('select');
select.innerHTML = '<option value="">请选择辅料</option>';
notions.forEach(function(n) {
var rem = Calculator.remainingQuantity(n.id, n.quantity, products);
var o = document.createElement('option');
o.value = n.id;
var label = n.name;
if (n.category) label += ' (' + n.category + ')';
label += ' [余' + rem + (n.unit ? n.unit : '') + ']';
o.textContent = label;
if (n.id === notionId) { o.selected = true; }
select.appendChild(o);
});

var inputRow = document.createElement('div');
inputRow.style.cssText = 'display:flex;gap:8px;align-items:center;';

var input = document.createElement('input');
input.type = 'number';
input.placeholder = '用量';
input.step = '0.01';
input.min = '0';
input.style.flex = '1';
if (quantityUsed) { input.value = quantityUsed; }

var unitLabel = document.createElement('span');
unitLabel.className = 'fabric-remaining-hint';
unitLabel.style.display = 'none';

function updateUnit() {
var nid = select.value;
var notion = notions.find(function(n) { return n.id === nid; });
if (!notion) { unitLabel.style.display = 'none'; return; }
var rem = Calculator.remainingQuantity(nid, notion.quantity, products);
unitLabel.style.display = 'inline-block';
unitLabel.textContent = '剩余 ' + rem + (notion.unit ? ' ' + notion.unit : '');
unitLabel.className = 'fabric-remaining-hint' + (rem <= 0 ? ' low' : '');
}
select.addEventListener('change', updateUnit);
if (notionId) { updateUnit(); }

var removeBtn = document.createElement('button');
removeBtn.type = 'button';
removeBtn.className = 'btn-remove-usage';
removeBtn.textContent = '✕';
removeBtn.addEventListener('click', function() { row.remove(); });

inputRow.appendChild(input);
inputRow.appendChild(unitLabel);
inputRow.appendChild(removeBtn);
row.appendChild(select);
row.appendChild(inputRow);
container.appendChild(row);
},

getNotionUsages() {
var rows = document.querySelectorAll('#notionUsageRows .fabric-usage-row');
var usages = [];
rows.forEach(function(row) {
var notionId = row.querySelector('select').value;
var quantityUsed = parseFloat(row.querySelector('input').value);
if (notionId && quantityUsed > 0) {
usages.push({ notionId: notionId, quantityUsed: quantityUsed });
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
document.getElementById('notionUsageRows').innerHTML = '';

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
if (product.notionUsages && product.notionUsages.length > 0) {
var self2 = this;
product.notionUsages.forEach(function(usage) {
self2.addNotionUsageRow(usage.notionId, usage.quantityUsed);
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
fabricUsages: this.getFabricUsages(),
notionUsages: this.getNotionUsages()
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
fabricUsages: data.fabricUsages,
notionUsages: data.notionUsages
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
/* 追加辅料用量：同辅料累加数量 */
if (data.notionUsages && data.notionUsages.length > 0) {
var existingNotions = origProduct.notionUsages ? JSON.parse(JSON.stringify(origProduct.notionUsages)) : [];
data.notionUsages.forEach(function(u) {
var found = false;
for (var i = 0; i < existingNotions.length; i++) {
if (existingNotions[i].notionId === u.notionId) {
existingNotions[i].quantityUsed = Math.round((Number(existingNotions[i].quantityUsed) + Number(u.quantityUsed)) * 100) / 100;
found = true;
break;
}
}
if (!found) { existingNotions.push({ notionId: u.notionId, quantityUsed: u.quantityUsed }); }
});
Store.update(Store.KEYS.PRODUCTS, this._duplicateSourceId, { notionUsages: existingNotions });
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
if (savedData.notionUsages && savedData.notionUsages.length > 0) {
savedData.notionUsages.forEach(function(usage) {
self.addNotionUsageRow(usage.notionId, usage.quantityUsed);
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
fabricUsages: product.fabricUsages || [],
notionUsages: product.notionUsages || []
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
if (product.notionUsages && product.notionUsages.length > 0) {
product.notionUsages.forEach(function(usage) {
self.addNotionUsageRow(usage.notionId, usage.quantityUsed);
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
html += '<div class="product-card" onclick="ProductController.openDetail(\'' + product.id + '\')" title="点击查看/编辑">';
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
html += '<button class="btn btn-icon" style="color:var(--blue-dark)" onclick="event.stopPropagation();ProductController.openPublishDialog(\'' + product.id + '\')" title="发布为作品">' + svgIcon('share') + '</button>';
html += '<button class="btn btn-icon" style="color:var(--green-dark)" onclick="event.stopPropagation();ProductController.duplicateProduct(\'' + product.id + '\')" title="再做一件">' + svgIcon('plus') + '</button>';
html += '<button class="btn btn-icon btn-danger" onclick="event.stopPropagation();ProductController.deleteProduct(\'' + product.id + '\')"title="删除">' + svgIcon('trash') + '</button>';
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

/* 详情浮窗 + 内联编辑（点击卡片打开）。布料用量/纸样联动仍用完整表单编辑 */
openDetail(id) {
var self = this;
var product = Store.getById(Store.KEYS.PRODUCTS, id);
if (!product) { return; }
function buildFields() {
var x = Store.getById(Store.KEYS.PRODUCTS, id);
if (!x) { return []; }
var pinfo = '';
if (x.patternId) { var pt = Store.getById(Store.KEYS.PATTERNS, x.patternId); pinfo = pt ? ((pt.name || '') + (pt.code ? ' (' + pt.code + ')' : '')) : ''; }
else if (x.patternSource || x.patternCode) { pinfo = (x.patternSource || '') + (x.patternCode ? ' ' + x.patternCode : ''); }
var fu = (x.fabricUsages || []).map(function(u) { return (u.fabricName || '布料') + ' ' + (u.metersUsed || 0) + '米'; }).join('、');
var nu = (x.notionUsages || []).map(function(u) {
var nm = u.notionName;
if (!nm) { var nn = Store.getById('sewing_notions', u.notionId); nm = nn ? nn.name : '辅料'; }
var unit = ''; var nn2 = Store.getById('sewing_notions', u.notionId); if (nn2 && nn2.unit) { unit = nn2.unit; }
return nm + ' ' + (u.quantityUsed || 0) + unit;
}).join('、');
var cost = window.computeCost ? computeCost(x).total : null;
return [
{ key: 'name', label: '名称', type: 'text', value: x.name, required: true },
{ key: 'category', label: '类别', type: 'select', value: x.category || '', options: OptionController.getOptions('productCategory'), allowAddKey: 'productCategory' },
{ key: 'completedDate', label: '完成日期', type: 'date', value: x.completedDate || '' },
{ key: 'user', label: '使用者', type: 'select', value: x.user || '', options: OptionController.getOptions('productUser'), allowAddKey: 'productUser' },
{ key: 'quantity', label: '数量', type: 'number', value: x.quantity || 1 },
{ key: 'tutorialLink', label: '教程链接', type: 'text', value: x.tutorialLink || '' },
{ key: '__pattern', label: '纸样', type: 'readonly', value: pinfo, format: function(v) { return v || '—'; } },
{ key: '__fabrics', label: '布料用量', type: 'readonly', value: fu, format: function(v) { return v || '—'; } },
{ key: '__notions', label: '辅料用量', type: 'readonly', value: nu, format: function(v) { return v || '—'; } },
{ key: '__cost', label: '成本(布料+辅料)', type: 'readonly', value: (cost != null ? '¥' + cost : ''), format: function(v) { return v || '—'; } }
];
}
DetailModal.open({
title: product.name || '制品详情',
image: { value: product.image, editable: true, onChange: function(ref) { Store.update(Store.KEYS.PRODUCTS, id, { image: ref }); self.renderList(); } },
fields: buildFields(),
rebuild: buildFields,
actions: [
{ label: '编辑布料/纸样等', icon: 'edit', className: 'btn-purple', onClick: function(dm) { dm.close(); self.openForm(id); } }
],
onSave: function(key, value) {
if (key === 'name' && !String(value).trim()) { return '名称不能为空'; }
var patch = {}; patch[key] = value;
Store.update(Store.KEYS.PRODUCTS, id, patch);
if (key === 'name') { var t = document.getElementById('detailModalTitle'); if (t) { t.textContent = value; } }
self.renderList();
return null;
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

