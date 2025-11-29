import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PageContainer, Card, Loading, Input, Select } from '../components/UI';
import { getOrders, updateOrder, updateOrderStatus, Order, CherryItem } from '../api';
import { isAuthenticated, clearAuthentication } from '../utils/auth';
import { ORDER_STATUS, CHERRY_VARIETIES, CHERRY_SIZES } from '../config';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/admin/login');
      return;
    }
    loadOrders();
  }, [filter]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const result = await getOrders(filter || undefined);
      setOrders(result.orders);
    } catch (error: any) {
      alert(`加载失败：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthentication();
    navigate('/admin/login');
  };

  const handleReview = async (orderId: number) => {
    if (!confirm('确认审核通过此订单？')) return;
    
    try {
      await updateOrderStatus(orderId, 'reviewed');
      alert('审核成功');
      loadOrders();
    } catch (error: any) {
      alert(`操作失败：${error.message}`);
    }
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;

    try {
      await updateOrder(editingOrder.id, {
        mall_order_no: editingOrder.mall_order_no,
        recipient_name: editingOrder.recipient_name,
        recipient_phone: editingOrder.recipient_phone,
        recipient_address: editingOrder.recipient_address,
        items: editingOrder.items,
      });
      alert('修改成功');
      setEditingOrder(null);
      loadOrders();
    } catch (error: any) {
      alert(`修改失败：${error.message}`);
    }
  };

  const updateEditingOrderField = (field: string, value: any) => {
    if (!editingOrder) return;
    setEditingOrder({ ...editingOrder, [field]: value });
  };

  const updateEditingItem = (index: number, field: keyof CherryItem, value: any) => {
    if (!editingOrder) return;
    const newItems = [...editingOrder.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditingOrder({ ...editingOrder, items: newItems });
  };

  return (
    <PageContainer maxWidth="xl">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">客服管理面板</h1>
          <Button variant="secondary" onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              筛选状态
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="">全部订单</option>
              <option value="pending">待审核</option>
              <option value="reviewed">已审核</option>
              <option value="shipped">已发货</option>
            </select>
          </div>
          <Button onClick={loadOrders}>刷新</Button>
        </div>
      </Card>

      {loading && <Loading />}

      {!loading && orders.length === 0 && (
        <Card>
          <p className="text-center text-gray-600">暂无订单</p>
        </Card>
      )}

      {!loading && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-600">订单编号</p>
                    <p className="text-xl font-semibold">{order.order_id}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      order.status === 'shipped'
                        ? 'bg-blue-100 text-blue-700'
                        : order.status === 'reviewed'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">商城订单号</p>
                    <p className="font-medium">{order.mall_order_no}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">收货人</p>
                    <p className="font-medium">{order.recipient_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">电话</p>
                    <p className="font-medium">{order.recipient_phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">地址</p>
                    <p className="font-medium">{order.recipient_address}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-2">商品清单</p>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="text-sm">
                        {item.variety} - {item.size} × {item.boxes}箱
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={() => handleEdit(order)}>
                    编辑
                  </Button>
                  {order.status === 'pending' && (
                    <Button onClick={() => handleReview(order.id)}>
                      审核通过
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">编辑订单 {editingOrder.order_id}</h2>
            
            <div className="space-y-4">
              <Input
                label="商城订单号"
                value={editingOrder.mall_order_no}
                onChange={(e) => updateEditingOrderField('mall_order_no', e.target.value)}
              />
              
              <Input
                label="收货人姓名"
                value={editingOrder.recipient_name}
                onChange={(e) => updateEditingOrderField('recipient_name', e.target.value)}
              />
              
              <Input
                label="收货人电话"
                value={editingOrder.recipient_phone}
                onChange={(e) => updateEditingOrderField('recipient_phone', e.target.value)}
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  收货地址
                </label>
                <textarea
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  rows={3}
                  value={editingOrder.recipient_address}
                  onChange={(e) => updateEditingOrderField('recipient_address', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  商品清单
                </label>
                {editingOrder.items.map((item, idx) => (
                  <div key={idx} className="mb-3 p-3 border border-gray-200 rounded-lg space-y-2">
                    <Select
                      label="品种"
                      value={item.variety}
                      onChange={(e) => updateEditingItem(idx, 'variety', e.target.value)}
                      options={CHERRY_VARIETIES.map(v => ({ value: v, label: v }))}
                    />
                    <Select
                      label="大小"
                      value={item.size}
                      onChange={(e) => updateEditingItem(idx, 'size', e.target.value)}
                      options={CHERRY_SIZES.map(s => ({ value: s, label: s }))}
                    />
                    <Input
                      label="箱数"
                      type="number"
                      value={item.boxes}
                      onChange={(e) => updateEditingItem(idx, 'boxes', parseInt(e.target.value) || 1)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button fullWidth onClick={handleSaveEdit}>
                保存
              </Button>
              <Button fullWidth variant="secondary" onClick={() => setEditingOrder(null)}>
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

