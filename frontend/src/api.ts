import { API_BASE_URL } from './config';

// API 请求封装
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(error.detail || `HTTP Error: ${response.status}`);
  }

  return response.json();
}

// 订单相关 API
export interface CherryItem {
  variety: string;
  size: string;
  boxes: number;
}

export interface OrderCreate {
  mall_order_no: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  items: CherryItem[];
}

export interface Order extends OrderCreate {
  id: number;
  order_id: string;
  status: string;
  tracking_number?: string;
  shipped_at?: number;
  created_at: number;
}

// 提交订单
export const createOrder = (data: OrderCreate) =>
  apiRequest<{ success: boolean; order_id: string; message: string }>(
    '/api/orders',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );

// 查询订单
export const searchOrders = (name: string, phone: string) =>
  apiRequest<{ orders: Order[] }>(
    `/api/orders/search?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`
  );

// 获取订单列表（管理端）
export const getOrders = (status?: string, page: number = 1) => {
  const params = new URLSearchParams({ page: page.toString() });
  if (status) params.append('status', status);
  return apiRequest<{ orders: Order[]; page: number; limit: number }>(
    `/api/orders?${params.toString()}`
  );
};

// 更新订单信息
export const updateOrder = (id: number, data: Partial<OrderCreate>) =>
  apiRequest<{ success: boolean; message: string }>(
    `/api/orders/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  );

// 更新订单状态
export const updateOrderStatus = (id: number, status: string) =>
  apiRequest<{ success: boolean; message: string }>(
    `/api/orders/${id}/status?status=${status}`,
    {
      method: 'PUT',
    }
  );

// 更新快递单号
export const updateTracking = (id: number, tracking_number: string) =>
  apiRequest<{ success: boolean; message: string }>(
    `/api/orders/${id}/tracking`,
    {
      method: 'PUT',
      body: JSON.stringify({ tracking_number }),
    }
  );

// 验证管理员密码
export const authenticate = (passcode: string, role?: 'admin' | 'logistics') =>
  apiRequest<{ success: boolean; message: string }>(
    '/api/auth',
    {
      method: 'POST',
      body: JSON.stringify({ passcode, role }),
    }
  );

// 查询快递物流信息（快递100）
export interface TrackingInfo {
  success: boolean;
  tracking_number: string;
  state: string;
  state_text: string;
  data: Array<{
    time: string;
    context: string;
    ftime: string;
  }>;
  company: string;
}

export const queryTracking = (trackingNumber: string, phone?: string) => {
  const params = phone ? `?phone=${encodeURIComponent(phone.slice(-4))}` : '';
  return apiRequest<TrackingInfo>(
    `/api/tracking/${trackingNumber}${params}`
  );
};

// 手动触发检查所有已发货订单的快递状态
export interface CheckDeliveryStatusResult {
  checked: number;
  updated: number;
  errors: number;
  timestamp: string;
}

export const manualCheckDeliveryStatus = () =>
  apiRequest<CheckDeliveryStatusResult>(
    '/api/cron/check-delivery-status',
    {
      method: 'POST',
    }
  );

