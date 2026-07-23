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
          // 只在初始化之后的登录事件才触发（避免和 getSession 重复）
          this.currentUser = session.user;
          this.onLoginSuccess();
        }
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.currentProfile = null;
        this.showLoginPage();
      }
    });

    // 检查当前会话
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
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
    const tier = this.currentProfile?.tier || 'free';
    const tierLabel = tier === 'pro' ? '⭐ Pro' : '免费版';
    el.innerHTML = `
      <div class="sidebar-user-name">${this.escapeHtml(nickname)}</div>
      <div class="sidebar-user-tier">${tierLabel}</div>
    `;
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
