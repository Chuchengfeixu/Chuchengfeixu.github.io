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
 select.value = selectedValue || '';
 InputDialog.open({ title: '新增类别', placeholder: '请输入新的类别名称' }).then(function(newVal) {
 if (newVal && newVal.trim()) {
 OptionController.addOption('productCategory', newVal.trim());
 TodoController.populateCategoryOptions(newVal.trim());
 }
 });
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
 select.value = selectedValue || '';
 InputDialog.open({ title: '新增使用者', placeholder: '请输入新的使用者名称' }).then(function(newVal) {
 if (newVal && newVal.trim()) {
 OptionController.addOption('productUser', newVal.trim());
 TodoController.populateUserOptions(newVal.trim());
 }
 });
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
 select.value = selectedValue || '';
 InputDialog.open({ title: '新增纸样来源', placeholder: '请输入新的纸样来源' }).then(function(newVal) {
 if (newVal && newVal.trim()) {
 OptionController.addOption('patternSource', newVal.trim());
 TodoController.populatePatternSourceOptions(newVal.trim());
 }
 });
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

