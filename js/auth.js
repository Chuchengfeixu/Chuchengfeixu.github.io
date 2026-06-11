// 认证模块
const Auth = {
  currentUser: null,
  currentProfile: null,

  async init() {
    // 监听认证状态变化
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        this.currentUser = session.user;
        this.onLoginSuccess();
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
    } else {
      this.showLoginPage();
    }
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
    // 刷新所有页面数据
    if (typeof FabricController !== 'undefined') {
      try {
        FabricController.renderList();
        ProductController.renderList();
        TodoController.renderList();
        PatternController.renderList();
        NotionController.renderList();
        DashboardController.refresh();
      } catch(e) { console.log('页面刷新延迟:', e); }
    }
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

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
