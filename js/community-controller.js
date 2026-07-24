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

