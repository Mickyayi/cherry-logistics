import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PageContainer, Card, Loading, Input } from '../components/UI';
import { getOrders, updateOrderStatus, updateTracking, type Order } from '../api';
import { isAuthenticated, clearAuthentication } from '../utils/auth';

export default function LogisticsPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'new' | 'shipping'>('new');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingInputs, setTrackingInputs] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/logistics/login');
      return;
    }
    loadOrders();
  }, [activeTab]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const status = activeTab === 'new' ? 'reviewed' : 'shipped';
      const result = await getOrders(status);
      setOrders(result.orders);
    } catch (error: any) {
      alert(`加载失败：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthentication();
    navigate('/logistics/login');
  };

  // 格式化单个订单的物流信息
  const formatSingleOrder = (order: Order): string => {
    const itemsText = order.items
      .map(item => `${item.boxes}箱 ${item.size} ${item.variety}`)
      .join('\n');
    
    return `${itemsText}\n${order.recipient_name} ${order.recipient_phone} ${order.recipient_address}`;
  };

  // 复制单个订单信息
  const copyOrderInfo = (order: Order) => {
    const text = formatSingleOrder(order);

    navigator.clipboard.writeText(text).then(() => {
      if (confirm('✅ 已复制到剪贴板\n\n是否标记为已发货？')) {
        handleMarkShipped(order.id);
      }
    }).catch(() => {
      alert('复制失败，请手动复制');
    });
  };

  // 复制所有订单信息
  const copyAllOrders = () => {
    if (orders.length === 0) {
      alert('没有可复制的订单');
      return;
    }

    const text = orders
      .map(order => formatSingleOrder(order))
      .join('\n\n\n');

    navigator.clipboard.writeText(text).then(() => {
      alert(`✅ 已复制 ${orders.length} 个订单到剪贴板`);
    }).catch(() => {
      alert('复制失败，请手动复制');
    });
  };

  const handleMarkShipped = async (orderId: number) => {
    try {
      await updateOrderStatus(orderId, 'shipped');
      alert('已标记为发货');
      loadOrders();
    } catch (error: any) {
      alert(`操作失败：${error.message}`);
    }
  };

  const handleUpdateTracking = async (orderId: number) => {
    const trackingNumber = trackingInputs[orderId];
    
    if (!trackingNumber || !trackingNumber.trim()) {
      alert('请输入快递单号');
      return;
    }

    try {
      await updateTracking(orderId, trackingNumber.trim());
      alert('快递单号已更新');
      setTrackingInputs({ ...trackingInputs, [orderId]: '' });
      loadOrders();
    } catch (error: any) {
      alert(`更新失败：${error.message}`);
    }
  };

  const updateTrackingInput = (orderId: number, value: string) => {
    setTrackingInputs({ ...trackingInputs, [orderId]: value });
  };

  return (
    <PageContainer maxWidth="lg">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">物流管理面板</h1>
          <Button variant="secondary" onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </div>

      {/* 标签切换 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('new')}
          className={`flex-1 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'new'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          📦 新订单
        </button>
        <button
          onClick={() => setActiveTab('shipping')}
          className={`flex-1 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'shipping'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300'
          }`}
        >
          🚚 正在配送
        </button>
      </div>

      {loading && <Loading />}

      {!loading && orders.length === 0 && (
        <Card>
          <p className="text-center text-gray-600">
            {activeTab === 'new' ? '暂无新订单' : '暂无配送中的订单'}
          </p>
        </Card>
      )}

      {/* 一键复制所有订单按钮 */}
      {!loading && orders.length > 0 && (
        <div className="mb-4">
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            onClick={copyAllOrders}
          >
            📋 一键复制所有物流信息 ({orders.length}个订单)
          </Button>
        </div>
      )}

      {/* 新订单列表 */}
      {!loading && activeTab === 'new' && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-600">订单编号</p>
                    <p className="text-xl font-semibold">{order.order_id}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
                    已审核
                  </span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">姓名：</span>
                    <span className="font-medium">{order.recipient_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">电话：</span>
                    <span className="font-medium">{order.recipient_phone}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">地址：</span>
                    <span className="font-medium">{order.recipient_address}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-gray-600">商品：</span>
                    <div className="mt-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="font-medium">
                          {item.boxes}箱 {item.size} {item.variety}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  fullWidth
                  size="lg"
                  onClick={() => copyOrderInfo(order)}
                >
                  📋 复制物流信息
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 配送中订单列表 */}
      {!loading && activeTab === 'shipping' && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-600">订单编号</p>
                    <p className="text-xl font-semibold">{order.order_id}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                    已发货
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-600">收货人：</span>
                    <span className="font-medium">{order.recipient_name}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">电话：</span>
                    <span className="font-medium">{order.recipient_phone}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">商品：</span>
                    <div className="font-medium">
                      {order.items.map((item, idx) => (
                        <div key={idx}>
                          {item.boxes}箱 {item.size} {item.variety}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {order.tracking_number ? (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">快递单号</p>
                    <p className="font-semibold text-green-700">{order.tracking_number}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="请输入快递单号"
                      value={trackingInputs[order.id] || ''}
                      onChange={(e) => updateTrackingInput(order.id, e.target.value)}
                    />
                    <Button
                      fullWidth
                      onClick={() => handleUpdateTracking(order.id)}
                    >
                      提交快递单号
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
