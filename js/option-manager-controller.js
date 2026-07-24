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

