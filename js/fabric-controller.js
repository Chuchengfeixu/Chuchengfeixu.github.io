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
 select.value = selectedValue || '';
 InputDialog.open({ title: '新增店铺', placeholder: '请输入新的店铺名称' }).then(function(newVal) {
 if (newVal && newVal.trim()) {
 OptionController.addOption('fabricShop', newVal.trim());
 FabricController.populateShopOptions(newVal.trim());
 }
 });
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
 select.value = selectedValue || '';
 InputDialog.open({ title: '新增幅宽', placeholder: '请输入新的幅宽值（如 120cm）' }).then(function(newVal) {
 if (newVal && newVal.trim()) {
 OptionController.addOption('fabricWidth', newVal.trim());
 FabricController.populateWidthOptions(newVal.trim());
 }
 });
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
 InputDialog.open({ title: '追加米数', message: '累加到「' + fabric.name + '」的总米数，当前 ' + (fabric.meters || 0) + ' 米', type: 'number', placeholder: '请输入追加的米数' }).then(function(input) {
 if (input === null) return;
 var add = Number(input);
 if (!isFinite(add) || add <= 0) { Toast.show('请输入大于 0 的数字', 'error'); return; }
 var newMeters = Math.round((Number(fabric.meters || 0) + add) * 100) / 100;
 Store.update(Store.KEYS.FABRICS, id, { meters: newMeters });
 Toast.show('已追加 ' + add + ' 米，总米数 ' + newMeters, 'success');
 FabricController.renderList();
 });
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

