// 云端数据层 - 重写 Store，保持同步读取接口，写入异步同步到 Supabase
// 策略：启动时加载数据到内存，读取从内存返回（同步），写入立即更新内存并后台同步云端
(function() {
'use strict';

// 获取 supabase 客户端引用
function getDB() { return window.supabaseClient; }

var TABLE_MAP = {
  'sewing_fabrics': 'fabrics',
  'sewing_products': 'products',
  'sewing_todos': 'todos',
  'sewing_patterns': 'patterns',
  'sewing_notions': 'notions',
  'sewing_scraps': 'scraps'
};

var _mem = {};
var _cloudLoaded = false;

function getUserId() {
  return (window.Auth && Auth.currentUser) ? Auth.currentUser.id : null;
}

// === 字段映射: 前端 -> 数据库 ===
function toDB(table, rec) {
  var r = {};
  if (table === 'fabrics') {
    if (rec.name !== undefined) r.name = rec.name;
    if (rec.shop !== undefined) r.shop = rec.shop;
    if (rec.code !== undefined) r.code = rec.code;
    if (rec.meters !== undefined) r.meters = parseFloat(rec.meters) || 0;
    if (rec.width !== undefined) r.width = rec.width;
    if (rec.weight !== undefined) r.weight = rec.weight;
    if (rec.price !== undefined) r.price = parseFloat(rec.price) || 0;
    if (rec.purchaseDate !== undefined) r.purchase_date = rec.purchaseDate || null;
    if (rec.image !== undefined) r.image_url = rec.image;
    if (rec.quality !== undefined) r.rating = rec.quality;
    if (rec.printed !== undefined) r.printed = rec.printed;
    if (rec.printedAt !== undefined) r.printed_at = rec.printedAt || null;
  } else if (table === 'products') {
    if (rec.name !== undefined) r.name = rec.name;
    if (rec.category !== undefined) r.category = rec.category;
    if (rec.completedDate !== undefined) r.finish_date = rec.completedDate || null;
    if (rec.user !== undefined) r.sewn_by = rec.user;
    if (rec.patternSource !== undefined) r.pattern_source = rec.patternSource;
    if (rec.patternId !== undefined) r.pattern_id = rec.patternId || null;
    if (rec.patternType !== undefined) r.pattern_type = rec.patternType;
    if (rec.patternCode !== undefined) r.pattern_code = rec.patternCode;
    if (rec.tutorialLink !== undefined) r.tutorial_link = rec.tutorialLink;
    if (rec.notes !== undefined) r.notes = rec.notes;
    if (rec.image !== undefined) r.image_url = rec.image;
    if (rec.quantity !== undefined) r.quantity = rec.quantity;
  } else if (table === 'todos') {
    if (rec.name !== undefined) r.name = rec.name;
    if (rec.note !== undefined) r.note = rec.note;
    if (rec.category !== undefined) r.category = rec.category;
    if (rec.image !== undefined) r.image_url = rec.image;
    if (rec.sortOrder !== undefined) r.sort_order = rec.sortOrder;
    if (rec.completed !== undefined) r.completed = rec.completed;
  } else if (table === 'patterns') {
    if (rec.name !== undefined) r.name = rec.name;
    if (rec.brand !== undefined) r.source = rec.brand;
    if (rec.code !== undefined) r.code = rec.code;
    if (rec.category !== undefined) r.category = rec.category;
    if (rec.size !== undefined) r.size = rec.size;
    if (rec.link !== undefined) r.link = rec.link;
    if (rec.notes !== undefined) r.notes = rec.notes;
    if (rec.note !== undefined) r.notes = rec.note;
    if (rec.image !== undefined) r.image_url = rec.image;
  } else if (table === 'notions') {
    if (rec.name !== undefined) r.name = rec.name;
    if (rec.category !== undefined) r.category = rec.category;
    if (rec.quantity !== undefined) r.quantity = parseInt(rec.quantity) || 0;
    if (rec.unit !== undefined) r.unit = rec.unit;
    if (rec.price !== undefined) r.price = parseFloat(rec.price) || 0;
    if (rec.shop !== undefined) r.shop = rec.shop;
    if (rec.purchaseDate !== undefined) r.purchase_date = rec.purchaseDate || null;
    if (rec.notes !== undefined) r.notes = rec.notes;
    if (rec.image !== undefined) r.image_url = rec.image;
  } else if (table === 'scraps') {
    if (rec.fabricId !== undefined) r.fabric_id = rec.fabricId;
    if (rec.fabricName !== undefined) r.fabric_name = rec.fabricName;
    if (rec.meters !== undefined) r.meters = parseFloat(rec.meters) || 0;
    if (rec.date !== undefined) r.scrap_date = rec.date || null;
  }
  return r;
}

// === 字段映射: 数据库 -> 前端 ===
function fromDB(table, row) {
  if (!row) return null;
  var r = { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
  if (table === 'fabrics') {
    r.name = row.name || '';
    r.shop = row.shop || '';
    r.code = row.code || '';
    r.meters = row.meters || 0;
    r.width = row.width || '';
    r.weight = row.weight || '';
    r.price = row.price || 0;
    r.purchaseDate = row.purchase_date || '';
    r.image = row.image_url || '';
    r.quality = row.rating || 0;
    r.printed = row.printed || false;
    r.printedAt = row.printed_at || '';
  } else if (table === 'products') {
    r.name = row.name || '';
    r.category = row.category || '';
    r.completedDate = row.finish_date || '';
    r.user = row.sewn_by || '';
    r.patternSource = row.pattern_source || '';
    r.patternId = row.pattern_id || '';
    r.patternType = row.pattern_type || '';
    r.patternCode = row.pattern_code || '';
    r.tutorialLink = row.tutorial_link || '';
    r.notes = row.notes || '';
    r.image = row.image_url || '';
    r.quantity = row.quantity || 1;
    r.fabricUsages = [];
  } else if (table === 'todos') {
    r.name = row.name || '';
    r.note = row.note || '';
    r.category = row.category || '';
    r.image = row.image_url || '';
    r.sortOrder = row.sort_order || 0;
    r.completed = row.completed || false;
  } else if (table === 'patterns') {
    r.name = row.name || '';
    r.brand = row.source || '';
    r.code = row.code || '';
    r.category = row.category || '';
    r.size = row.size || '';
    r.link = row.link || '';
    r.notes = row.notes || '';
    r.note = row.notes || '';
    r.image = row.image_url || '';
  } else if (table === 'notions') {
    r.name = row.name || '';
    r.category = row.category || '';
    r.quantity = row.quantity || '';
    r.unit = row.unit || '';
    r.price = row.price || 0;
    r.shop = row.shop || '';
    r.purchaseDate = row.purchase_date || '';
    r.notes = row.notes || '';
    r.image = row.image_url || '';
  } else if (table === 'scraps') {
    r.fabricId = row.fabric_id || '';
    r.fabricName = row.fabric_name || '';
    r.meters = row.meters || 0;
    r.date = row.scrap_date || '';
  }
  return r;
}

// === 同步失败处理：兜底写本地 + 提示用户 ===
// 反查内存 key（TABLE_MAP 是 key -> table）
function keyForTable(table) {
  for (var k in TABLE_MAP) { if (TABLE_MAP[k] === table) return k; }
  return null;
}

// 把某张表当前内存数据兜底写回 localStorage，防止刷新后丢失
function persistLocal(table) {
  var key = keyForTable(table);
  if (!key || !_mem[key]) return;
  try { localStorage.setItem(key, JSON.stringify(_mem[key])); }
  catch (e) { console.error('[兜底写本地失败]', key, e); }
}

// 防抖提示，避免同一批操作连环弹窗
var _syncErrorTimer = null;
function notifySyncError() {
  if (_syncErrorTimer) return;
  _syncErrorTimer = setTimeout(function () { _syncErrorTimer = null; }, 4000);
  if (window.Toast && Toast.show) {
    Toast.show('⚠️ 网络异常，数据未能同步到云端，已暂存本地，请联网后重新编辑保存', 'error');
  }
}

function onSyncFail(action, table, msg) {
  console.error('[云端' + action + '失败]', table, msg);
  persistLocal(table);   // 兜底：把内存写回本地
  notifySyncError();     // 提示用户
}

// 包装一个 supabase 写操作：同时处理"返回 error"和"断网 reject"两种失败
function runSync(action, table, promise) {
  return promise.then(function (res) {
    if (res && res.error) { onSyncFail(action, table, res.error.message); return false; }
    return true;
  }).catch(function (err) {
    onSyncFail(action, table, (err && err.message) || '网络请求失败');
    return false;
  });
}

// === 后台同步到云端 ===
function syncToCloud(action, table, id, data) {
  if (!table) return;
  var userId = getUserId();
  if (!userId) return;

  if (action === 'add') {
    var dbData = toDB(table, data);
    dbData.id = id;
    dbData.user_id = userId;
    runSync('add', table, getDB().from(table).insert(dbData));
    if (table === 'products' && data.fabricUsages && data.fabricUsages.length > 0) {
      var rows = data.fabricUsages.map(function(u) {
        return { product_id: id, fabric_id: u.fabricId, fabric_name: u.fabricName || '', meters_used: parseFloat(u.metersUsed) || 0, user_id: userId };
      });
      runSync('add', 'products', getDB().from('product_fabrics').insert(rows));
    }
  } else if (action === 'update') {
    var dbData = toDB(table, data);
    runSync('update', table, getDB().from(table).update(dbData).eq('id', id));
    if (table === 'products' && data.fabricUsages !== undefined) {
      getDB().from('product_fabrics').delete().eq('product_id', id).then(function() {
        if (data.fabricUsages && data.fabricUsages.length > 0) {
          var rows = data.fabricUsages.map(function(u) {
            return { product_id: id, fabric_id: u.fabricId, fabric_name: u.fabricName || '', meters_used: parseFloat(u.metersUsed) || 0, user_id: getUserId() };
          });
          runSync('update', 'products', getDB().from('product_fabrics').insert(rows));
        }
      }).catch(function(err) { onSyncFail('update', 'products', (err && err.message) || '网络请求失败'); });
    }
  } else if (action === 'remove') {
    if (table === 'products') {
      getDB().from('product_fabrics').delete().eq('product_id', id).then(function() {
        runSync('remove', table, getDB().from(table).delete().eq('id', id));
      }).catch(function(err) { onSyncFail('remove', table, (err && err.message) || '网络请求失败'); });
    } else {
      runSync('remove', table, getDB().from(table).delete().eq('id', id));
    }
  }
}

// === 从云端加载所有数据 ===
async function loadFromCloud() {
  try {
    var db = getDB();
    var results = await Promise.all([
      db.from('fabrics').select('*').order('created_at', { ascending: false }),
      db.from('products').select('*').order('created_at', { ascending: false }),
      db.from('todos').select('*').order('sort_order', { ascending: true }),
      db.from('patterns').select('*').order('created_at', { ascending: false }),
      db.from('notions').select('*').order('created_at', { ascending: false }),
      db.from('product_fabrics').select('*'),
      db.from('scraps').select('*').order('created_at', { ascending: false })
    ]);

    var fabrics = (results[0].data || []).map(function(r) { return fromDB('fabrics', r); });
    var products = (results[1].data || []).map(function(r) { return fromDB('products', r); });
    var todos = (results[2].data || []).map(function(r) { return fromDB('todos', r); });
    var patterns = (results[3].data || []).map(function(r) { return fromDB('patterns', r); });
    var notions = (results[4].data || []).map(function(r) { return fromDB('notions', r); });
    var pfRows = results[5].data || [];
    var scraps = (results[6].data || []).map(function(r) { return fromDB('scraps', r); });

    // 给 products 附上 fabricUsages
    products.forEach(function(p) {
      p.fabricUsages = pfRows
        .filter(function(pf) { return pf.product_id === p.id; })
        .map(function(pf) { return { fabricId: pf.fabric_id, fabricName: pf.fabric_name || '', metersUsed: pf.meters_used }; });
    });

    _mem['sewing_fabrics'] = fabrics;
    _mem['sewing_products'] = products;
    _mem['sewing_todos'] = todos;
    _mem['sewing_patterns'] = patterns;
    _mem['sewing_notions'] = notions;
    _mem['sewing_scraps'] = scraps;

    // 如果云端 scraps 为空，尝试从 localStorage 迁移
    if (scraps.length === 0) {
      var scrapsRaw = localStorage.getItem('sewing_scraps');
      var localScraps = scrapsRaw ? JSON.parse(scrapsRaw) : [];
      if (localScraps.length > 0) {
        _mem['sewing_scraps'] = localScraps;
        // 后台迁移到云端
        var userId = getUserId();
        localScraps.forEach(function(s) {
          var dbData = toDB('scraps', s);
          dbData.id = s.id;
          dbData.user_id = userId;
          db.from('scraps').insert(dbData).then(function(res) {
            if (res.error) console.error('[迁移scraps]', res.error.message);
          });
        });
        console.log('[DataLayer] 已迁移 ' + localScraps.length + ' 条报废记录到云端');
      }
    }

    _cloudLoaded = true;
    console.log('[DataLayer] 云端数据已加载');
    return true;
  } catch (e) {
    console.error('[DataLayer] 加载失败:', e);
    _cloudLoaded = false;
    return false;
  }
}

// === 重写全局 Store 对象 ===
window.Store = {
  KEYS: {
    FABRICS: 'sewing_fabrics',
    PRODUCTS: 'sewing_products',
    TODOS: 'sewing_todos',
    OPTIONS: 'sewing_options',
    SCRAPS: 'sewing_scraps',
    PATTERNS: 'sewing_patterns',
    NOTIONS: 'sewing_notions'
  },

  getAll: function(key) {
    if (_cloudLoaded && _mem[key]) return _mem[key];
    try { var d = localStorage.getItem(key); return d ? JSON.parse(d) : []; }
    catch(e) { return []; }
  },

  getById: function(key, id) {
    var items = this.getAll(key);
    return items.find(function(item) { return item.id === id; }) || null;
  },

  add: function(key, record) {
    var items = this.getAll(key);
    var now = new Date().toISOString();
    record.id = generateUUID();
    record.createdAt = now;
    record.updatedAt = now;
    items.push(record);

    if (_cloudLoaded) { _mem[key] = items; }

    var table = TABLE_MAP[key];
    if (table && _cloudLoaded) {
      syncToCloud('add', table, record.id, record);
    } else {
      localStorage.setItem(key, JSON.stringify(items));
    }
    return record;
  },

  update: function(key, id, data) {
    var items = this.getAll(key);
    var idx = items.findIndex(function(item) { return item.id === id; });
    if (idx === -1) return null;

    data.updatedAt = new Date().toISOString();
    items[idx] = Object.assign({}, items[idx], data);

    if (_cloudLoaded) { _mem[key] = items; }

    var table = TABLE_MAP[key];
    if (table && _cloudLoaded) {
      syncToCloud('update', table, id, data);
    } else {
      localStorage.setItem(key, JSON.stringify(items));
    }
    return items[idx];
  },

  remove: function(key, id) {
    var items = this.getAll(key);
    var filtered = items.filter(function(item) { return item.id !== id; });
    if (filtered.length === items.length) return false;

    if (_cloudLoaded) { _mem[key] = filtered; }

    var table = TABLE_MAP[key];
    if (table && _cloudLoaded) {
      syncToCloud('remove', table, id, null);
    } else {
      localStorage.setItem(key, JSON.stringify(filtered));
    }
    return true;
  },

  exportAll: function() {
    var self = this;
    return ImageStore.getAll().then(function(images) {
      return JSON.stringify({
        version: '2.0', exportDate: new Date().toISOString(),
        data: {
          fabrics: self.getAll(self.KEYS.FABRICS),
          products: self.getAll(self.KEYS.PRODUCTS),
          todos: self.getAll(self.KEYS.TODOS),
          scraps: self.getAll(self.KEYS.SCRAPS),
          patterns: self.getAll(self.KEYS.PATTERNS),
          notions: self.getAll(self.KEYS.NOTIONS),
          options: JSON.parse(localStorage.getItem(self.KEYS.OPTIONS) || '{}')
        },
        images: images
      }, null, 2);
    });
  },

  importAll: async function(jsonString) {
    try {
      var imported = JSON.parse(jsonString);
      if (!imported.version || !imported.data) return false;

      var userId = getUserId();
      if (!userId) {
        if (window.Toast) Toast.show('未登录，无法导入到云端', 'error');
        return false;
      }

      var db = getDB();
      // 用 upsert（按主键 id 冲突则更新），避免重复导入时主键冲突导致失败
      var tables = ['fabrics', 'products', 'todos', 'patterns', 'notions', 'scraps'];
      var hadError = false;

      for (var i = 0; i < tables.length; i++) {
        var t = tables[i];
        var key = 'sewing_' + t;
        var records = imported.data[t];
        if (!records || !records.length) continue;

        // 更新内存
        _mem[key] = records;

        // 构造批量 upsert 行（保留原 id + 绑定当前用户）
        var rows = records.map(function(rec) {
          var row = toDB(t, rec);
          row.id = rec.id;
          row.user_id = userId;
          return row;
        });

        try {
          var res = await db.from(t).upsert(rows);
          if (res.error) { hadError = true; console.error('[导入upsert]', t, res.error.message); }
        } catch (e) {
          hadError = true; console.error('[导入upsert异常]', t, e.message);
        }

        // products 的布料用量关联表：先删旧关联再插入，避免重复
        if (t === 'products') {
          var pfRows = [];
          records.forEach(function(p) {
            if (p.fabricUsages && p.fabricUsages.length) {
              p.fabricUsages.forEach(function(u) {
                pfRows.push({ product_id: p.id, fabric_id: u.fabricId, fabric_name: u.fabricName || '', meters_used: parseFloat(u.metersUsed) || 0, user_id: userId });
              });
            }
          });
          try {
            var pids = records.map(function(p) { return p.id; });
            await db.from('product_fabrics').delete().in('product_id', pids);
            if (pfRows.length) {
              var pfRes = await db.from('product_fabrics').insert(pfRows);
              if (pfRes.error) { hadError = true; console.error('[导入product_fabrics]', pfRes.error.message); }
            }
          } catch (e) { hadError = true; console.error('[导入product_fabrics异常]', e.message); }
        }

        // 兜底写本地，保证刷新前后一致
        try { localStorage.setItem(key, JSON.stringify(records)); } catch (e) {}
      }

      if (imported.data.options) {
        localStorage.setItem('sewing_options', JSON.stringify(imported.data.options));
      }

      // 图片存入本地 IndexedDB
      if (imported.images) {
        var promises = [];
        for (var k in imported.images) { promises.push(ImageStore.save(k, imported.images[k])); }
        try { await Promise.all(promises); } catch (e) { console.error('[导入图片]', e); }
      }

      if (hadError) {
        if (window.Toast) Toast.show('⚠️ 部分数据未能导入云端，请检查网络后重试', 'error');
        return false;
      }
      return true;
    } catch(e) {
      console.error('importAll error:', e);
      return false;
    }
  },

  checkStorageQuota: function() {
    return { used: 0, total: Infinity, available: Infinity };
  }
};

// 暴露加载函数
window.DataLayer = {
  loadFromCloud: loadFromCloud,
  isLoaded: function() { return _cloudLoaded; }
};

})();
