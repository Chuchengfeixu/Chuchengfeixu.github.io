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


