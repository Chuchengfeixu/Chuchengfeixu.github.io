// 云端数据层 - 重写 Store，保持同步读取接口，写入异步同步到 Supabase
// 策略：启动时加载数据到内存，读取从内存返回（同步），写入立即更新内存并后台同步云端
(function() {
'use strict';

var TABLE_MAP = {
  'sewing_fabrics': 'fabrics',
  'sewing_products': 'products',
  'sewing_todos': 'todos',
  'sewing_patterns': 'patterns',
  'sewing_notions': 'notions',
  'sewing_scraps': null
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
  }
  return r;
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
    supabase.from(table).insert(dbData).then(function(res) {
      if (res.error) console.error('[云端add]', table, res.error.message);
    });
    if (table === 'products' && data.fabricUsages && data.fabricUsages.length > 0) {
      var rows = data.fabricUsages.map(function(u) {
        return { product_id: id, fabric_id: u.fabricId, fabric_name: u.fabricName || '', meters_used: parseFloat(u.metersUsed) || 0, user_id: userId };
      });
      supabase.from('product_fabrics').insert(rows).then(function(res) {
        if (res.error) console.error('[云端add product_fabrics]', res.error.message);
      });
    }
  } else if (action === 'update') {
    var dbData = toDB(table, data);
    supabase.from(table).update(dbData).eq('id', id).then(function(res) {
      if (res.error) console.error('[云端update]', table, res.error.message);
    });
    if (table === 'products' && data.fabricUsages !== undefined) {
      supabase.from('product_fabrics').delete().eq('product_id', id).then(function() {
        if (data.fabricUsages && data.fabricUsages.length > 0) {
          var rows = data.fabricUsages.map(function(u) {
            return { product_id: id, fabric_id: u.fabricId, fabric_name: u.fabricName || '', meters_used: parseFloat(u.metersUsed) || 0, user_id: getUserId() };
          });
          supabase.from('product_fabrics').insert(rows).then(function(res) {
            if (res.error) console.error('[云端update product_fabrics]', res.error.message);
          });
        }
      });
    }
  } else if (action === 'remove') {
    if (table === 'products') {
      supabase.from('product_fabrics').delete().eq('product_id', id).then(function() {
        supabase.from(table).delete().eq('id', id).then(function(res) {
          if (res.error) console.error('[云端remove]', table, res.error.message);
        });
      });
    } else {
      supabase.from(table).delete().eq('id', id).then(function(res) {
        if (res.error) console.error('[云端remove]', table, res.error.message);
      });
    }
  }
}

// === 从云端加载所有数据 ===
async function loadFromCloud() {
  try {
    var results = await Promise.all([
      supabase.from('fabrics').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('todos').select('*').order('sort_order', { ascending: true }),
      supabase.from('patterns').select('*').order('created_at', { ascending: false }),
      supabase.from('notions').select('*').order('created_at', { ascending: false }),
      supabase.from('product_fabrics').select('*')
    ]);

    var fabrics = (results[0].data || []).map(function(r) { return fromDB('fabrics', r); });
    var products = (results[1].data || []).map(function(r) { return fromDB('products', r); });
    var todos = (results[2].data || []).map(function(r) { return fromDB('todos', r); });
    var patterns = (results[3].data || []).map(function(r) { return fromDB('patterns', r); });
    var notions = (results[4].data || []).map(function(r) { return fromDB('notions', r); });
    var pfRows = results[5].data || [];

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

    // scraps 保留 localStorage
    var scrapsRaw = localStorage.getItem('sewing_scraps');
    _mem['sewing_scraps'] = scrapsRaw ? JSON.parse(scrapsRaw) : [];

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

  importAll: function(jsonString) {
    try {
      var imported = JSON.parse(jsonString);
      if (!imported.version || !imported.data) return Promise.resolve(false);
      var tables = ['fabrics', 'products', 'todos', 'patterns', 'notions'];
      tables.forEach(function(t) {
        var key = 'sewing_' + t;
        if (imported.data[t]) {
          _mem[key] = imported.data[t];
          imported.data[t].forEach(function(record) { syncToCloud('add', t, record.id, record); });
        }
      });
      if (imported.data.scraps) {
        _mem['sewing_scraps'] = imported.data.scraps;
        localStorage.setItem('sewing_scraps', JSON.stringify(imported.data.scraps));
      }
      if (imported.data.options) {
        localStorage.setItem('sewing_options', JSON.stringify(imported.data.options));
      }
      if (imported.images) {
        var promises = [];
        for (var k in imported.images) { promises.push(ImageStore.save(k, imported.images[k])); }
        return Promise.all(promises).then(function() { return true; });
      }
      return Promise.resolve(true);
    } catch(e) {
      console.error('importAll error:', e);
      return Promise.resolve(false);
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
