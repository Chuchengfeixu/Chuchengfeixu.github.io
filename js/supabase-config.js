// Supabase 配置
var SUPABASE_URL = 'https://xvelfruexeyqtdxarwcd.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZWxmcnVleGV5cXRkeGFyd2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzA3ODIsImV4cCI6MjA5NjY0Njc4Mn0.H5TIRfDCgdRmVM9L2yKH5uVWDx6Gt94PBbXPjQS6bHo';

// 初始化 Supabase 客户端
// CDN v2 暴露的全局对象可能是 window.supabase 或 window.supabase.createClient
var supabaseClient;
if (window.supabase && window.supabase.createClient) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else if (window.supabase && window.supabase.SupabaseClient) {
  supabaseClient = new window.supabase.SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error('[supabase-config] window.supabase 对象异常:', window.supabase);
}
console.log('[supabase-config] supabaseClient:', supabaseClient ? '初始化成功' : '初始化失败');
console.log('[supabase-config] auth:', supabaseClient && supabaseClient.auth ? '存在' : '不存在');
