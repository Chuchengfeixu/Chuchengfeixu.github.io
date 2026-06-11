// Supabase 配置
var SUPABASE_URL = 'https://xvelfruexeyqtdxarwcd.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZWxmcnVleGV5cXRkeGFyd2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzA3ODIsImV4cCI6MjA5NjY0Njc4Mn0.H5TIRfDCgdRmVM9L2yKH5uVWDx6Gt94PBbXPjQS6bHo';

// 初始化 Supabase 客户端（用 _supabaseClient 避免跟 CDN 全局变量冲突）
var _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// 覆盖全局 supabase 为初始化后的客户端
window.supabase = _supabaseClient;
