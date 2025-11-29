import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PageContainer, Input, Select } from '../components/UI';
import { getOrders, updateOrder, updateOrderStatus, updateTracking, type Order, type CherryItem } from '../api';
import { isAuthenticated, clearAuthentication } from '../utils/auth';
import { ORDER_STATUS, CHERRY_VARIETIES, CHERRY_SIZES } from '../config';

export default function AdminPanel() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editingTrackingId, setEditingTrackingId] = useState<number | null>(null);
  const [trackingInput, setTrackingInput] = useState<string>('');

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

  const handleEditTracking = (order: Order) => {
    setEditingTrackingId(order.id);
    setTrackingInput(order.tracking_number || '');
  };

  const handleSaveTracking = async (orderId: number) => {
    if (!trackingInput.trim()) {
      alert('请输入快递单号');
      return;
    }

    try {
      await updateTracking(orderId, trackingInput.trim());
      alert('快递单号已更新');
      setEditingTrackingId(null);
      setTrackingInput('');
      loadOrders();
    } catch (error: any) {
      alert(`更新失败：${error.message}`);
    }
  };

  const formatItems = (items: CherryItem[]) => {
    return items.map(item => `${item.variety} ${item.size} ×${item.boxes}箱`).join(', ');
  };

  return (
    <PageContainer maxWidth="full">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">客服管理面板</h1>
          <Button variant="secondary" onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
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
      </div>

      {/* 表格视图 */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-600">
          暂无订单
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    订单号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    商城订单号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    收货人
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    电话
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    地址
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    商品
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    快递单号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.order_id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === 'shipped'
                            ? 'bg-blue-100 text-blue-700'
                            : order.status === 'reviewed'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {order.mall_order_no}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {order.recipient_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {order.recipient_phone}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={order.recipient_address}>
                      {order.recipient_address}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={formatItems(order.items)}>
                      {formatItems(order.items)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {editingTrackingId === order.id ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={trackingInput}
                            onChange={(e) => setTrackingInput(e.target.value)}
                            className="w-32 px-2 py-1 text-xs border border-gray-300 rounded"
                            placeholder="输入单号"
                          />
                          <button
                            onClick={() => handleSaveTracking(order.id)}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingTrackingId(null)}
                            className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {order.tracking_number || '-'}
                          </span>
                          <button
                            onClick={() => handleEditTracking(order)}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            {order.tracking_number ? '修改' : '填写'}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(order)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          编辑
                        </button>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleReview(order.id)}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            审核
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
