// Cherry Logistics Backend API
// Cloudflare Workers with D1 Database

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },

  // Cron Trigger: 每天00:00自动检查快递状态
  async scheduled(event, env, ctx) {
    console.log('Cron job started at:', new Date().toISOString());
    ctx.waitUntil(checkAndUpdateDeliveryStatus(env));
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
      response = await authenticate(body.passcode, body.role);
    }
    // Query express tracking (快递100)
    else if (path.startsWith('/api/tracking/') && method === 'GET') {
      const trackingNumber = path.split('/')[3];
      const phone = url.searchParams.get('phone'); // 顺丰需要手机号后四位
      response = await queryExpressTracking(trackingNumber, phone, env);
    }
    // Manual trigger: Check and update delivery status
    else if (path === '/api/cron/check-delivery-status' && method === 'POST') {
      response = await checkAndUpdateDeliveryStatus(env);
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
    `SELECT id, mall_order_no, recipient_phone, status, tracking_number, created_at
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
    recipient_phone: row.recipient_phone,
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

async function authenticate(passcode, role) {
  const ADMIN_PASSCODE = '145284';
  const LOGISTICS_PASSCODE = '8888';

  // If role is specified, check against the specific role's password
  if (role === 'admin') {
    if (passcode === ADMIN_PASSCODE) {
      return { success: true, message: '验证成功' };
    }
  } else if (role === 'logistics') {
    if (passcode === LOGISTICS_PASSCODE) {
      return { success: true, message: '验证成功' };
    }
  } else {
    // Backward compatibility: if no role specified, check both (but this shouldn't happen with updated frontend)
    if (passcode === ADMIN_PASSCODE || passcode === LOGISTICS_PASSCODE) {
      return { success: true, message: '验证成功' };
    }
  }

  throw new Error('密码错误');
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

    // 调试：记录完整响应
    console.log('Kuaidi100 API Response:', JSON.stringify(result));

    // 快递100 返回格式：
    // 成功: { message: 'ok', nu: '...', ischeck: '1', condition: '...', com: '...', status: '200', state: '...', data: [...] }
    // 失败: { message: '错误信息', nu: '', ischeck: '0', condition: '', com: '', status: '4xx/500', state: '', data: [] }

    if (result.status !== '200' || result.message !== 'ok') {
      // 特殊处理：查询无结果的情况（返回友好提示，但success=false）
      if (result.returnCode === '500' || result.message.includes('查询无结果') || result.message.includes('请隔段时间')) {
        return {
          success: false,
          error: '该快递单号暂无物流信息，可能是刚发货尚未录入系统。建议明日再查询，或联系快递公司确认单号。',
          tracking_number: trackingNumber,
        };
      }
      // 其他错误
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
    throw new Error(error.message);
  }
}

// 生成 MD5 签名（完整实现）
function generateMD5(str) {
  function rotateLeft(value, shift) {
    return (value << shift) | (value >>> (32 - shift));
  }

  function addUnsigned(x, y) {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  function F(x, y, z) { return (x & y) | ((~x) & z); }
  function G(x, y, z) { return (x & z) | (y & (~z)); }
  function H(x, y, z) { return x ^ y ^ z; }
  function I(x, y, z) { return y ^ (x | (~z)); }

  function FF(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(str) {
    const wordArray = [];
    const len = str.length;
    for (let i = 0; i < len; i++) {
      wordArray[i >> 2] |= (str.charCodeAt(i) & 0xFF) << ((i % 4) * 8);
    }
    return wordArray;
  }

  function utf8Encode(str) {
    str = str.replace(/\r\n/g, '\n');
    let utftext = '';
    for (let n = 0; n < str.length; n++) {
      const c = str.charCodeAt(n);
      if (c < 128) {
        utftext += String.fromCharCode(c);
      } else if ((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      } else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
    }
    return utftext;
  }

  str = utf8Encode(str);
  const x = convertToWordArray(str);
  const len = str.length * 8;

  x[len >> 5] |= 0x80 << (len % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a, oldb = b, oldc = c, oldd = d;

    a = FF(a, b, c, d, x[i], 7, -680876936);
    d = FF(d, a, b, c, x[i + 1], 12, -389564586);
    c = FF(c, d, a, b, x[i + 2], 17, 606105819);
    b = FF(b, c, d, a, x[i + 3], 22, -1044525330);
    a = FF(a, b, c, d, x[i + 4], 7, -176418897);
    d = FF(d, a, b, c, x[i + 5], 12, 1200080426);
    c = FF(c, d, a, b, x[i + 6], 17, -1473231341);
    b = FF(b, c, d, a, x[i + 7], 22, -45705983);
    a = FF(a, b, c, d, x[i + 8], 7, 1770035416);
    d = FF(d, a, b, c, x[i + 9], 12, -1958414417);
    c = FF(c, d, a, b, x[i + 10], 17, -42063);
    b = FF(b, c, d, a, x[i + 11], 22, -1990404162);
    a = FF(a, b, c, d, x[i + 12], 7, 1804603682);
    d = FF(d, a, b, c, x[i + 13], 12, -40341101);
    c = FF(c, d, a, b, x[i + 14], 17, -1502002290);
    b = FF(b, c, d, a, x[i + 15], 22, 1236535329);

    a = GG(a, b, c, d, x[i + 1], 5, -165796510);
    d = GG(d, a, b, c, x[i + 6], 9, -1069501632);
    c = GG(c, d, a, b, x[i + 11], 14, 643717713);
    b = GG(b, c, d, a, x[i], 20, -373897302);
    a = GG(a, b, c, d, x[i + 5], 5, -701558691);
    d = GG(d, a, b, c, x[i + 10], 9, 38016083);
    c = GG(c, d, a, b, x[i + 15], 14, -660478335);
    b = GG(b, c, d, a, x[i + 4], 20, -405537848);
    a = GG(a, b, c, d, x[i + 9], 5, 568446438);
    d = GG(d, a, b, c, x[i + 14], 9, -1019803690);
    c = GG(c, d, a, b, x[i + 3], 14, -187363961);
    b = GG(b, c, d, a, x[i + 8], 20, 1163531501);
    a = GG(a, b, c, d, x[i + 13], 5, -1444681467);
    d = GG(d, a, b, c, x[i + 2], 9, -51403784);
    c = GG(c, d, a, b, x[i + 7], 14, 1735328473);
    b = GG(b, c, d, a, x[i + 12], 20, -1926607734);

    a = HH(a, b, c, d, x[i + 5], 4, -378558);
    d = HH(d, a, b, c, x[i + 8], 11, -2022574463);
    c = HH(c, d, a, b, x[i + 11], 16, 1839030562);
    b = HH(b, c, d, a, x[i + 14], 23, -35309556);
    a = HH(a, b, c, d, x[i + 1], 4, -1530992060);
    d = HH(d, a, b, c, x[i + 4], 11, 1272893353);
    c = HH(c, d, a, b, x[i + 7], 16, -155497632);
    b = HH(b, c, d, a, x[i + 10], 23, -1094730640);
    a = HH(a, b, c, d, x[i + 13], 4, 681279174);
    d = HH(d, a, b, c, x[i], 11, -358537222);
    c = HH(c, d, a, b, x[i + 3], 16, -722521979);
    b = HH(b, c, d, a, x[i + 6], 23, 76029189);
    a = HH(a, b, c, d, x[i + 9], 4, -640364487);
    d = HH(d, a, b, c, x[i + 12], 11, -421815835);
    c = HH(c, d, a, b, x[i + 15], 16, 530742520);
    b = HH(b, c, d, a, x[i + 2], 23, -995338651);

    a = II(a, b, c, d, x[i], 6, -198630844);
    d = II(d, a, b, c, x[i + 7], 10, 1126891415);
    c = II(c, d, a, b, x[i + 14], 15, -1416354905);
    b = II(b, c, d, a, x[i + 5], 21, -57434055);
    a = II(a, b, c, d, x[i + 12], 6, 1700485571);
    d = II(d, a, b, c, x[i + 3], 10, -1894986606);
    c = II(c, d, a, b, x[i + 10], 15, -1051523);
    b = II(b, c, d, a, x[i + 1], 21, -2054922799);
    a = II(a, b, c, d, x[i + 8], 6, 1873313359);
    d = II(d, a, b, c, x[i + 15], 10, -30611744);
    c = II(c, d, a, b, x[i + 6], 15, -1560198380);
    b = II(b, c, d, a, x[i + 13], 21, 1309151649);
    a = II(a, b, c, d, x[i + 4], 6, -145523070);
    d = II(d, a, b, c, x[i + 11], 10, -1120210379);
    c = II(c, d, a, b, x[i + 2], 15, 718787259);
    b = II(b, c, d, a, x[i + 9], 21, -343485551);

    a = addUnsigned(a, olda);
    b = addUnsigned(b, oldb);
    c = addUnsigned(c, oldc);
    d = addUnsigned(d, oldd);
  }

  function wordToHex(value) {
    let hex = '';
    for (let i = 0; i < 4; i++) {
      const byte = (value >>> (i * 8)) & 0xFF;
      hex += byte.toString(16).padStart(2, '0');
    }
    return hex;
  }

  return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
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

// 定时任务：自动检查并更新快递状态
async function checkAndUpdateDeliveryStatus(env) {
  console.log('Starting automatic delivery status check...');

  try {
    // 1. 获取所有"已发货"状态且有快递单号的订单
    const result = await env.DB.prepare(
      `SELECT id, tracking_number, recipient_phone 
       FROM orders 
       WHERE status = 'shipped' AND tracking_number IS NOT NULL`
    ).all();

    if (!result.results || result.results.length === 0) {
      console.log('No shipped orders found to check.');
      return { checked: 0, updated: 0 };
    }

    const orders = result.results;
    console.log(`Found ${orders.length} shipped orders to check.`);

    let checkedCount = 0;
    let updatedCount = 0;
    const errors = [];

    // 2. 逐个查询快递状态
    for (const order of orders) {
      try {
        // 获取手机号后四位
        const phone = order.recipient_phone ? order.recipient_phone.slice(-4) : '';

        // 查询快递状态
        const trackingInfo = await queryExpressTracking(order.tracking_number, phone, env);
        checkedCount++;

        // 3. 如果状态是"已签收"（state = '3'），更新订单状态为"已完成"
        if (trackingInfo.state === '3') {
          await env.DB.prepare(
            'UPDATE orders SET status = ? WHERE id = ?'
          ).bind('completed', order.id).run();

          updatedCount++;
          console.log(`Order ${order.id} (${order.tracking_number}) marked as completed.`);
        } else {
          console.log(`Order ${order.id} (${order.tracking_number}) status: ${trackingInfo.state_text}`);
        }

        // 添加延迟，避免频繁调用API（每次间隔1秒）
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error checking order ${order.id}:`, error.message);
        errors.push({ orderId: order.id, error: error.message });
      }
    }

    const summary = {
      checked: checkedCount,
      updated: updatedCount,
      errors: errors.length,
      timestamp: new Date().toISOString(),
    };

    console.log('Cron job completed:', JSON.stringify(summary));
    return summary;

  } catch (error) {
    console.error('Fatal error in cron job:', error);
    throw error;
  }
}
