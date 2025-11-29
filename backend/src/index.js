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
      response = await queryExpressTracking(trackingNumber, env);
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
async function queryExpressTracking(trackingNumber, env) {
  if (!trackingNumber) {
    throw new Error('请提供快递单号');
  }

  // 快递100 API 配置
  const KUAIDI100_CUSTOMER = env.KUAIDI100_CUSTOMER || '8355F619EE92D96EEBFC8926A99ED965';
  const KUAIDI100_KEY = env.KUAIDI100_KEY || 'sRXQlxxD9337';
  
  // 快递100 API 参数
  const param = JSON.stringify({
    com: 'shunfeng', // 顺丰快递代码
    num: trackingNumber,
  });

  // 生成签名：MD5(param + key + customer)
  const sign = await generateMD5(`${param}${KUAIDI100_KEY}${KUAIDI100_CUSTOMER}`);

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

// 生成 MD5 签名
async function generateMD5(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
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

