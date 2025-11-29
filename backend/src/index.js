// Cherry Logistics Backend API
// Cloudflare Workers with D1 Database

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let response;

    // Root endpoint
    if (path === '/' || path === '') {
      response = { message: 'Cherry Logistics API', version: '1.0.0' };
    }
    // Create order
    else if (path === '/api/orders' && method === 'POST') {
      response = await createOrder(request, env);
    }
    // Search orders
    else if (path === '/api/orders/search' && method === 'GET') {
      const name = url.searchParams.get('name');
      const phone = url.searchParams.get('phone');
      response = await searchOrders(name, phone, env);
    }
    // Get orders list
    else if (path === '/api/orders' && method === 'GET') {
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      response = await getOrders(status, page, env);
    }
    // Update order
    else if (path.startsWith('/api/orders/') && method === 'PUT') {
      const parts = path.split('/');
      const orderId = parseInt(parts[3]);
      
      if (path.endsWith('/status')) {
        const status = url.searchParams.get('status');
        response = await updateOrderStatus(orderId, status, env);
      } else if (path.endsWith('/tracking')) {
        const body = await request.json();
        response = await updateTracking(orderId, body.tracking_number, env);
      } else {
        const body = await request.json();
        response = await updateOrder(orderId, body, env);
      }
    }
    // Auth
    else if (path === '/api/auth' && method === 'POST') {
      const body = await request.json();
      response = await authenticate(body.passcode);
    }
    // Query express tracking (快递100)
    else if (path.startsWith('/api/tracking/') && method === 'GET') {
      const trackingNumber = path.split('/')[3];
      const phone = url.searchParams.get('phone'); // 顺丰需要手机号后四位
      response = await queryExpressTracking(trackingNumber, phone, env);
    }
    else {
      return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
    }

    return jsonResponse(response, 200, corsHeaders);
  } catch (error) {
    console.error('Error:', error);
    return jsonResponse({ detail: error.message || 'Internal server error' }, 500, corsHeaders);
  }
}

// Helper functions
function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    },
  });
}

function formatOrderId(id) {
  return String(id).padStart(3, '0');
}

const ORDER_STATUS_TEXT = {
  pending: '待审核',
  reviewed: '已审核',
  shipped: '已发货',
  completed: '已完成',
};

// API Handlers

async function createOrder(request, env) {
  const data = await request.json();
  const { mall_order_no, recipient_name, recipient_phone, recipient_address, items } = data;

  if (!mall_order_no || !recipient_name || !recipient_phone || !recipient_address || !items) {
    throw new Error('缺少必填字段');
  }

  const itemsJson = JSON.stringify(items);
  const timestamp = Math.floor(Date.now() / 1000);

  const result = await env.DB.prepare(
    `INSERT INTO orders (mall_order_no, recipient_name, recipient_phone, recipient_address, items, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`
  )
    .bind(mall_order_no, recipient_name, recipient_phone, recipient_address, itemsJson, timestamp)
    .run();

  const orderId = result.meta.last_row_id;

  return {
    success: true,
    order_id: formatOrderId(orderId),
    message: '订单提交成功',
  };
}

async function searchOrders(name, phone, env) {
  if (!name || !phone) {
    throw new Error('请提供姓名和电话');
  }

  const result = await env.DB.prepare(
    `SELECT id, mall_order_no, status, tracking_number, created_at
     FROM orders
     WHERE recipient_name = ? AND recipient_phone = ?
     ORDER BY created_at DESC`
  )
    .bind(name, phone)
    .all();

  if (!result.results || result.results.length === 0) {
    throw new Error('未找到匹配的订单');
  }

  const orders = result.results.map(row => ({
    order_id: formatOrderId(row.id),
    mall_order_no: row.mall_order_no,
    status: row.status,
    status_text: ORDER_STATUS_TEXT[row.status] || '未知',
    tracking_number: row.tracking_number,
    created_at: row.created_at,
  }));

  return { orders };
}

async function getOrders(status, page, env) {
  const limit = 50;
  const offset = (page - 1) * limit;

  let query, params;
  
  if (status) {
    query = `SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params = [status, limit, offset];
  } else {
    query = `SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params = [limit, offset];
  }

  const result = await env.DB.prepare(query).bind(...params).all();

  const orders = result.results.map(row => ({
    id: row.id,
    order_id: formatOrderId(row.id),
    mall_order_no: row.mall_order_no,
    recipient_name: row.recipient_name,
    recipient_phone: row.recipient_phone,
    recipient_address: row.recipient_address,
    items: JSON.parse(row.items),
    status: row.status,
    tracking_number: row.tracking_number,
    created_at: row.created_at,
  }));

  return { orders, page, limit };
}

async function updateOrder(orderId, data, env) {
  const updates = [];
  const values = [];

  if (data.mall_order_no !== undefined) {
    updates.push('mall_order_no = ?');
    values.push(data.mall_order_no);
  }
  if (data.recipient_name !== undefined) {
    updates.push('recipient_name = ?');
    values.push(data.recipient_name);
  }
  if (data.recipient_phone !== undefined) {
    updates.push('recipient_phone = ?');
    values.push(data.recipient_phone);
  }
  if (data.recipient_address !== undefined) {
    updates.push('recipient_address = ?');
    values.push(data.recipient_address);
  }
  if (data.items !== undefined) {
    updates.push('items = ?');
    values.push(JSON.stringify(data.items));
  }

  if (updates.length === 0) {
    throw new Error('没有提供需要更新的字段');
  }

  values.push(orderId);
  const query = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;

  await env.DB.prepare(query).bind(...values).run();

  return { success: true, message: '订单更新成功' };
}

async function updateOrderStatus(orderId, status, env) {
  const validStatuses = ['pending', 'reviewed', 'shipped', 'completed'];
  
  if (!validStatuses.includes(status)) {
    throw new Error('无效的状态值');
  }

  await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?')
    .bind(status, orderId)
    .run();

  return { success: true, message: '状态更新成功' };
}

async function updateTracking(orderId, trackingNumber, env) {
  // 允许空值（清除快递单号），将空字符串或 null 存储为 NULL
  const trackingValue = trackingNumber && trackingNumber.trim() ? trackingNumber.trim() : null;

  await env.DB.prepare('UPDATE orders SET tracking_number = ? WHERE id = ?')
    .bind(trackingValue, orderId)
    .run();

  return { success: true, message: '快递单号更新成功' };
}

async function authenticate(passcode) {
  const ADMIN_PASSCODE = '8888';

  if (passcode === ADMIN_PASSCODE) {
    return { success: true, message: '验证成功' };
  } else {
    throw new Error('密码错误');
  }
}

// 查询快递物流信息（快递100）
async function queryExpressTracking(trackingNumber, phone, env) {
  if (!trackingNumber) {
    throw new Error('请提供快递单号');
  }

  // 快递100 API 配置
  const KUAIDI100_CUSTOMER = env.KUAIDI100_CUSTOMER || '8355F619EE92D96EEBFC8926A99ED965';
  const KUAIDI100_KEY = env.KUAIDI100_KEY || 'sRXQlxxD9337';
  
  // 快递100 API 参数
  // 顺丰快递需要提供收件人或寄件人手机号后四位
  const param = JSON.stringify({
    com: 'shunfeng', // 顺丰快递代码
    num: trackingNumber,
    phone: phone || '', // 顺丰必须：收件人或寄件人手机号后四位
  });

  // 生成签名：MD5(param + key + customer)
  const sign = generateMD5(`${param}${KUAIDI100_KEY}${KUAIDI100_CUSTOMER}`);

  // 构建请求 URL
  const apiUrl = 'https://poll.kuaidi100.com/poll/query.do';
  const formData = new URLSearchParams({
    customer: KUAIDI100_CUSTOMER,
    sign: sign.toUpperCase(),
    param: param,
  });

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const result = await response.json();

    // 快递100 返回格式：
    // { result: true/false, message: '...', data: [...], state: '0/1/2/3' }
    if (result.result === false || result.returnCode !== '200') {
      throw new Error(result.message || '查询失败');
    }

    return {
      success: true,
      tracking_number: trackingNumber,
      state: result.state, // 0:在途 1:揽收 2:疑难 3:签收 4:退签 5:派件 6:退回
      state_text: getStateText(result.state),
      data: result.data || [], // 物流轨迹列表
      company: '顺丰速运',
    };
  } catch (error) {
    console.error('Kuaidi100 API Error:', error);
    throw new Error(`物流查询失败：${error.message}`);
  }
}

// 生成 MD5 签名（使用纯 JS 实现）
function generateMD5(text) {
  // 使用一个简单的MD5实现
  // 注意：这是一个简化版本，实际生产环境建议使用完整的MD5库
  function md5cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }
  
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }
  
  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }
  
  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }
  
  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  
  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }
  
  function add32(a, b) {
    return (a + b) & 0xFFFFFFFF;
  }
  
  function md51(s) {
    const n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    for (i = 64; i <= s.length; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++)
      tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }
  
  function md5blk(s) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }
  
  function rhex(n) {
    let s = '';
    for (let j = 0; j < 4; j++)
      s += String.fromCharCode((n >> (j * 8)) & 0xFF);
    return s;
  }
  
  function hex(x) {
    for (let i = 0; i < x.length; i++)
      x[i] = rhex(x[i]);
    return x.join('');
  }
  
  // Convert string to UTF-8 bytes
  function str2rstr_utf8(input) {
    return unescape(encodeURIComponent(input));
  }
  
  // Main MD5 function
  return hex(md51(str2rstr_utf8(text)));
}

// 物流状态文本映射
function getStateText(state) {
  const stateMap = {
    '0': '运输中',
    '1': '已揽收',
    '2': '疑难件',
    '3': '已签收',
    '4': '退签',
    '5': '派送中',
    '6': '退回',
  };
  return stateMap[state] || '未知状态';
}

