// Supabase 配置
const SUPABASE_URL = 'https://xvelfruexeyqtdxarwcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZWxmcnVleGV5cXRkeGFyd2NkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzA3ODIsImV4cCI6MjA5NjY0Njc4Mn0.H5TIRfDCgdRmVM9L2yKH5uVWDx6Gt94PBbXPjQS6bHo';

// 初始化 Supabase 客户端
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
