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

