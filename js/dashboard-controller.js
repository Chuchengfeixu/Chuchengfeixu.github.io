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

