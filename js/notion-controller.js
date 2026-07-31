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
 select.value = selectedValue || '';
 InputDialog.open({ title: '新增选项', placeholder: '请输入新选项' }).then(function(newVal) {
 if (newVal && newVal.trim()) {
 OptionController.addOption(optionField, newVal.trim());
 NotionController.populateOptions(selectId, optionField, newVal.trim());
 }
 });
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
 InputDialog.open({ title: '追加数量', message: '累加到「' + n.name + '」的库存，当前 ' + (n.quantity || 0) + (n.unit ? ' ' + n.unit : ''), type: 'number', placeholder: '请输入追加的数量' }).then(function(input) {
 if (input === null) return;
 var add = Number(input);
 if (!isFinite(add) || add <= 0) { Toast.show('请输入大于 0 的数字', 'error'); return; }
 var newQty = Math.round((Number(n.quantity || 0) + add) * 100) / 100;
 Store.update(Store.KEYS.NOTIONS, id, { quantity: newQty });
 Toast.show('已追加 ' + add + (n.unit ? ' ' + n.unit : '') + '，库存 ' + newQty, 'success');
 NotionController.renderList();
 });
 },

 /* 详情浮窗 + 内联编辑（点击卡片打开） */
 openDetail(id) {
 var self = this;
 var n = Store.getById(Store.KEYS.NOTIONS, id);
 if (!n) { return; }
 function buildFields() {
 var x = Store.getById(Store.KEYS.NOTIONS, id);
 if (!x) { return []; }
 var remQ = Calculator.remainingQuantity(id, x.quantity, Store.getAll(Store.KEYS.PRODUCTS));
 return [
 { key: 'name', label: '名称', type: 'text', value: x.name, required: true },
 { key: 'category', label: '类别', type: 'select', value: x.category || '', options: OptionController.getOptions('notionCategory'), allowAddKey: 'notionCategory' },
 { key: 'shop', label: '店铺', type: 'select', value: x.shop || '', options: OptionController.getOptions('notionShop'), allowAddKey: 'notionShop' },
 { key: 'quantity', label: '库存数量', type: 'number', value: x.quantity },
 { key: 'unit', label: '单位', type: 'select', value: x.unit || '', options: OptionController.getOptions('notionUnit'), allowAddKey: 'notionUnit' },
 { key: 'price', label: '价格', type: 'number', value: x.price, prefix: '¥' },
 { key: 'purchaseDate', label: '购买日期', type: 'date', value: x.purchaseDate || '' },
 { key: '__remaining', label: '剩余', type: 'readonly', value: remQ + ' / ' + (x.quantity || 0) + (x.unit ? ' ' + x.unit : '') }
 ];
 }
 DetailModal.open({
 title: n.name || '辅料详情',
 image: { value: n.image, editable: true, onChange: function(ref) { Store.update(Store.KEYS.NOTIONS, id, { image: ref }); self.renderList(); } },
 fields: buildFields(),
 rebuild: buildFields,
 onSave: function(key, value) {
 if (key === 'name' && !String(value).trim()) { return '名称不能为空'; }
 var patch = {}; patch[key] = value;
 Store.update(Store.KEYS.NOTIONS, id, patch);
 if (key === 'name') { var t = document.getElementById('detailModalTitle'); if (t) { t.textContent = value; } }
 self.renderList();
 return null;
 }
 });
 },

 renderList() {
 var self = this;
 var notions = Store.getAll(Store.KEYS.NOTIONS);
 var products = Store.getAll(Store.KEYS.PRODUCTS);
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
 var remQ = Calculator.remainingQuantity(n.id, n.quantity, products);
 html += '<span class="lt-col lt-col-meters" style="color:' + (remQ <= 0 ? 'var(--coral)' : 'inherit') + '">' + remQ + ' / ' + (n.quantity || 0) + (n.unit ? ' ' + n.unit : '') + '</span>';
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
 html += '<div class="fabric-card" style="border-top:none;" onclick="NotionController.openDetail(\'' + n.id + '\')" title="点击查看/编辑">';
 /* 图片区域 */
 if (n.image) { html += '<img id="ntimg_' + n.id + '" class="fabric-card-image" alt="">'; }
 else { html += '<div class="fabric-card-image-placeholder" style="background:linear-gradient(135deg,#F5EFD8,#F0ECE0);"></div>'; }
 /* 信息区域 */
 html += '<div class="fabric-card-info">';
 html += '<div class="fabric-card-header"><span class="fabric-card-name">' + self.escapeHtml(n.name) + '</span>';
 html += '<div class="fabric-card-actions"><button class="btn btn-icon" style="color:var(--green-dark)" onclick="event.stopPropagation();NotionController.addQuantity(\'' + n.id + '\')" title="追加数量">' + svgIcon('plus') + '</button>';
 html += '<button class="btn btn-icon btn-danger" onclick="event.stopPropagation();NotionController.deleteNotion(\'' + n.id + '\')" title="删除">' + svgIcon('trash') + '</button></div></div>';
 html += '<div class="fabric-card-body">';
 if (n.category) html += '<div class="fabric-card-row"><span class="fabric-card-label">类别</span><span class="fabric-card-value">' + self.escapeHtml(n.category) + '</span></div>';
 var remQ = Calculator.remainingQuantity(n.id, n.quantity, products);
 html += '<div class="fabric-card-row"><span class="fabric-card-label">剩余</span><span class="fabric-card-value" style="color:' + (remQ <= 0 ? 'var(--coral)' : 'var(--green-dark)') + '">' + remQ + ' / ' + (n.quantity || 0) + (n.unit ? ' ' + n.unit : '') + '</span></div>';
 html += '<div class="fabric-card-row"><span class="fabric-card-label">价格</span><span class="fabric-card-value">¥' + n.price + '</span></div>';
 html += '</div>';
 html += '</div></div>';
 });
 container.innerHTML = html;
 notions.forEach(function(n) { if (n.image) { var el = document.getElementById('ntimg_' + n.id); if (el) loadIdbImage(el, n.image); } });
 },

 escapeHtml(str) { if (!str) return ''; var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
};


