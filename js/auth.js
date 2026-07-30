// 认证模块
const Auth = {
  currentUser: null,
  currentProfile: null,
  _initialized: false,

  async init() {
    // 监听认证状态变化
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        if (this._initialized) {
          // 仅当用户实际变化时才当作"新登录"处理
          // 避免窗口切换 / token 刷新时 supabase 重复派发 SIGNED_IN 导致重复弹"登录成功"
          if (!this.currentUser || this.currentUser.id !== session.user.id) {
            this.currentUser = session.user;
            this.onLoginSuccess();
          }
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // token 刷新只更新引用，不提示、不重复加载
        this.currentUser = session.user;
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.currentProfile = null;
        this.showLoginPage();
      }
    });

    // 检查当前会话（异步期间显示等待态、锁住输入）
    this.showChecking('正在检查登录状态，请稍候…');
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      // 有已存会话：无需输入，提示用户等待即可
      this.showChecking('检测到已登录账号，正在为你恢复，请稍候…');
      this.currentUser = session.user;
      await this.loadProfile();
      try { await DataLayer.loadFromCloud(); } catch(e) { console.error('数据加载失败:', e); }
      this.showApp();
      window.dispatchEvent(new Event('dataReady'));
    } else {
      this.showLoginPage();
    }
    this._initialized = true;
  },

  // 显示"检查/恢复登录"等待态，并隐藏登录/注册表单（防止自动登录期间误输入）
  showChecking(message) {
    var chk = document.getElementById('authChecking');
    if (chk) chk.style.display = '';
    var txt = document.getElementById('authCheckingText');
    if (txt && message) txt.textContent = message;
    var lf = document.getElementById('loginForm');
    var rf = document.getElementById('registerForm');
    if (lf) lf.style.display = 'none';
    if (rf) rf.style.display = 'none';
  },

  async loadProfile() {
    if (!this.currentUser) return;
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', this.currentUser.id)
      .single();
    if (data) {
      this.currentProfile = data;
    }
  },

  async onLoginSuccess() {
    await this.loadProfile();
    try { await DataLayer.loadFromCloud(); } catch(e) { console.error('数据加载失败:', e); }
    this.showApp();
    // 触发全局数据就绪事件，所有页面刷新
    window.dispatchEvent(new Event('dataReady'));
    Toast.show('登录成功 👋', 'success');
  },

  showLoginPage() {
    document.getElementById('authPage').style.display = '';
    document.getElementById('appMain').style.display = 'none';
    // 无会话/已登出：隐藏等待态，显示登录表单供输入
    var chk = document.getElementById('authChecking');
    if (chk) chk.style.display = 'none';
    var lf = document.getElementById('loginForm');
    var rf = document.getElementById('registerForm');
    if (lf) lf.style.display = 'block';
    if (rf) rf.style.display = 'none';
    var title = document.getElementById('authTitle');
    if (title) title.textContent = '登录';
  },

  showApp() {
    document.getElementById('authPage').style.display = 'none';
    document.getElementById('appMain').style.display = '';
    // 更新侧边栏用户信息
    this.updateUserDisplay();
  },

  updateUserDisplay() {
    const el = document.getElementById('sidebarUserInfo');
    if (!el) return;
    const email = this.currentUser?.email || '';
    const nickname = this.currentProfile?.nickname || email.split('@')[0];
    const isPro = this.isPro();
    let tierLabel = isPro ? '⭐ Pro' : '免费版';
    if (isPro && this.currentProfile?.tier_expires_at) {
      tierLabel += ' · 至 ' + String(this.currentProfile.tier_expires_at).slice(0, 10);
    }
    el.innerHTML = `
      <div class="sidebar-user-name">${this.escapeHtml(nickname)}</div>
      <div class="sidebar-user-tier">${tierLabel}</div>
      <div class="sidebar-user-quota" id="sidebarUserQuota" style="font-size:11px;color:var(--text-light);margin-top:2px;"></div>
    `;
    // 免费用户展示本月图片配额（需求 16 / 8.5）
    if (!isPro && window.QuotaService) {
      QuotaService.getUsageStatus().then(function(s) {
        var q = document.getElementById('sidebarUserQuota');
        if (q && s && s.limit > 0) { q.textContent = '本月图片 ' + s.used + ' / ' + s.limit; }
      });
    }
  },

  // 注册
  async register(email, password) {
    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password
    });
    if (error) {
      throw new Error(error.message);
    }
    return data;
  },

  // 登录
  async login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });
    if (error) {
      throw new Error(error.message);
    }
    return data;
  },

  // 登出
  async logout() {
    await supabaseClient.auth.signOut();
  },

  // 检查是否为 Pro 用户
  isPro() {
    if (!this.currentProfile) return false;
    if (this.currentProfile.tier !== 'pro') return false;
    // 检查是否过期
    if (this.currentProfile.tier_expires_at) {
      return new Date(this.currentProfile.tier_expires_at) > new Date();
    }
    return true;
  },

  // 统一的 Pro 功能门禁：是 Pro 放行返回 true；否则弹升级引导并返回 false
  // featureKey 对应 Paywall.FEATURES 的键（如 'image-quota' / 'analytics'）
  requirePro(featureKey) {
    if (this.isPro()) return true;
    if (window.Paywall && typeof Paywall.show === 'function') {
      Paywall.show(featureKey);
    } else if (window.Toast) {
      Toast.show('该功能为 Pro 专属，升级后解锁', 'warning');
    }
    return false;
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// 暴露到 window，供 data-layer.js 的 getUserId() 等通过 window.Auth 访问
// （const 声明不会自动挂到 window 上，缺此会导致 getUserId 恒为 null → 发布等操作误判未登录）
window.Auth = Auth;
