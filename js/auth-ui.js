// 登录/注册界面交互逻辑
const AuthUI = {
  init() {
    const self = this;

    // 切换登录/注册表单
    document.getElementById('showRegister').addEventListener('click', function(e) {
      e.preventDefault();
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('registerForm').style.display = 'block';
      document.getElementById('authTitle').textContent = '注册账号';
      self.clearErrors();
    });

    document.getElementById('showLogin').addEventListener('click', function(e) {
      e.preventDefault();
      document.getElementById('registerForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('authTitle').textContent = '登录';
      self.clearErrors();
    });

    // 登录提交
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      self.clearErrors();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      if (!email || !password) {
        self.showError('loginError', '请填写邮箱和密码');
        return;
      }

      self.setLoading('loginBtn', true);
      try {
        await Auth.login(email, password);
      } catch (err) {
        self.showError('loginError', self.translateError(err.message));
      } finally {
        self.setLoading('loginBtn', false);
      }
    });

    // 注册提交
    document.getElementById('registerForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      self.clearErrors();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      const confirmPassword = document.getElementById('registerConfirmPassword').value;

      if (!email || !password) {
        self.showError('registerError', '请填写邮箱和密码');
        return;
      }

      if (password.length < 6) {
        self.showError('registerError', '密码至少需要6位');
        return;
      }

      if (password !== confirmPassword) {
        self.showError('registerError', '两次输入的密码不一致');
        return;
      }

      self.setLoading('registerBtn', true);
      try {
        await Auth.register(email, password);
        Toast.show('注册成功，已自动登录', 'success');
      } catch (err) {
        self.showError('registerError', self.translateError(err.message));
      } finally {
        self.setLoading('registerBtn', false);
      }
    });

    // 登出按钮
    document.getElementById('btnLogout').addEventListener('click', async function() {
      await Auth.logout();
    });
  },

  clearErrors() {
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('registerError').style.display = 'none';
  },

  showError(elementId, message) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.style.display = 'block';
  },

  setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (loading) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.textContent = '请稍候...';
    } else {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || '提交';
    }
  },

  translateError(msg) {
    if (msg.includes('Invalid login credentials')) return '邮箱或密码错误';
    if (msg.includes('User already registered')) return '该邮箱已注册';
    if (msg.includes('Email not confirmed')) return '请先验证邮箱';
    if (msg.includes('Password should be at least')) return '密码至少需要6位';
    if (msg.includes('Unable to validate email')) return '邮箱格式无效';
    if (msg.includes('Email rate limit exceeded')) return '请求过于频繁，请稍后重试';
    return msg;
  }
};
