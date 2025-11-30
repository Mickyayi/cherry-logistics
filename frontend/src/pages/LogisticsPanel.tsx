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
  const [showBatchTrackingModal, setShowBatchTrackingModal] = useState(false);
  const [batchTrackingText, setBatchTrackingText] = useState('');

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

  // 兼容性复制函数（支持Android）
  const copyToClipboard = async (text: string): Promise<boolean> => {
    // 方法1：尝试使用现代Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.log('Clipboard API failed, trying fallback method');
      }
    }

    // 方法2：使用传统的execCommand方法（兼容旧版Android）
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;

      // 防止页面滚动和键盘弹出
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      // 尝试复制
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        return true;
      }
    } catch (err) {
      console.error('Fallback copy method failed:', err);
    }

    return false;
  };

  // 复制单个订单信息
  const copyOrderInfo = async (order: Order) => {
    const text = formatSingleOrder(order);

    const success = await copyToClipboard(text);

    if (success) {
      if (confirm('✅ 已复制到剪贴板\n\n是否标记为已发货？')) {
        handleMarkShipped(order.id);
      }
    } else {
      // 显示文本供用户手动复制
      alert(`复制失败，请手动复制以下内容：\n\n${text}`);
    }
  };

  // 复制所有订单信息
  const copyAllOrders = async () => {
    if (orders.length === 0) {
      alert('没有可复制的订单');
      return;
    }

    const text = orders
      .map(order => formatSingleOrder(order))
      .join('\n\n\n');

    const success = await copyToClipboard(text);

    if (success) {
      if (activeTab === 'new') {
        // 只有在新订单标签页才询问是否标记为已发货
        if (confirm(`✅ 已复制 ${orders.length} 个订单到剪贴板\n\n是否将这些订单全部标记为已发货？`)) {
          await markAllAsShipped();
        }
      } else {
        alert(`✅ 已复制 ${orders.length} 个订单到剪贴板`);
      }
    } else {
      // 显示文本供用户手动复制
      alert(`复制失败，请手动复制以下内容：\n\n${text.substring(0, 500)}${text.length > 500 ? '\n\n...(内容过长，请在浏览器中查看完整内容)' : ''}`);
    }
  };

  // 批量标记为已发货
  const markAllAsShipped = async () => {
    try {
      // 并行处理所有订单
      await Promise.all(
        orders.map(order => updateOrderStatus(order.id, 'shipped'))
      );
      alert(`已将 ${orders.length} 个订单标记为已发货`);
      loadOrders();
    } catch (error: any) {
      alert(`批量标记失败：${error.message}`);
    }
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

  // 批量处理快递单号
  const handleBatchTracking = async () => {
    if (!batchTrackingText.trim()) {
      alert('请粘贴快递信息');
      return;
    }

    const lines = batchTrackingText.trim().split('\n');
    const updates: { orderId: number; trackingNumber: string; name: string }[] = [];
    const duplicateNames: string[] = [];
    const notFoundNames: string[] = [];

    // 解析每行数据
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 格式：SF3274601602023	鲍剑	DURANT 32+
      const parts = trimmedLine.split(/\s+/);
      if (parts.length < 2) {
        alert(`格式错误：${trimmedLine}\n\n正确格式：SF3274601602023 鲍剑 DURANT 32+`);
        return;
      }

      const trackingNumber = parts[0];
      const recipientName = parts[1];

      // 检查快递单号格式（以SF开头）
      if (!trackingNumber.startsWith('SF')) {
        alert(`快递单号格式错误：${trackingNumber}\n\n快递单号应以SF开头`);
        return;
      }

      // 在当前订单中查找匹配的姓名
      const matchedOrders = orders.filter(
        order => order.recipient_name === recipientName
      );

      if (matchedOrders.length === 0) {
        notFoundNames.push(recipientName);
      } else if (matchedOrders.length === 1) {
        updates.push({
          orderId: matchedOrders[0].id,
          trackingNumber: trackingNumber,
          name: recipientName,
        });
      } else {
        // 多个相同姓名
        duplicateNames.push(recipientName);
      }
    }

    // 显示警告信息
    if (notFoundNames.length > 0) {
      alert(`以下收货人在当前订单中未找到：\n${notFoundNames.join(', ')}\n\n请检查姓名是否正确`);
      return;
    }

    if (duplicateNames.length > 0) {
      const confirmMsg = `以下收货人有多个订单，需要手动填写：\n${duplicateNames.join(', ')}\n\n其他订单将正常填写，是否继续？`;
      if (!confirm(confirmMsg)) {
        return;
      }
    }

    // 执行批量更新
    try {
      await Promise.all(
        updates.map(({ orderId, trackingNumber }) =>
          updateTracking(orderId, trackingNumber)
        )
      );

      let successMsg = `✅ 成功填写 ${updates.length} 个快递单号`;
      if (duplicateNames.length > 0) {
        successMsg += `\n\n⚠️ 以下收货人有重复，请手动填写：\n${duplicateNames.join(', ')}`;
      }

      alert(successMsg);
      setShowBatchTrackingModal(false);
      setBatchTrackingText('');
      loadOrders();
    } catch (error: any) {
      alert(`批量填写失败：${error.message}`);
    }
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
          className={`flex-1 py-3 rounded-lg font-medium transition-all ${activeTab === 'new'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300'
            }`}
        >
          📦 新订单
        </button>
        <button
          onClick={() => setActiveTab('shipping')}
          className={`flex-1 py-3 rounded-lg font-medium transition-all ${activeTab === 'shipping'
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

      {/* 一键复制所有订单按钮（仅新订单） */}
      {!loading && orders.length > 0 && activeTab === 'new' && (
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

      {/* 一键填写快递单号按钮（仅配送中） */}
      {!loading && orders.length > 0 && activeTab === 'shipping' && (
        <div className="mb-4">
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            onClick={() => setShowBatchTrackingModal(true)}
          >
            📦 一键填写快递单号 ({orders.length}个订单)
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
          {orders.map((order) => {
            // 计算发货天数
            const shippedDays = order.shipped_at
              ? Math.floor((Date.now() / 1000 - order.shipped_at) / 86400)
              : null;
            const isOverdue = shippedDays !== null && shippedDays > 5;

            return (
              <Card key={order.id} className={isOverdue ? 'border-2 border-red-500' : ''}>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-600">订单编号</p>
                      <p className="text-xl font-semibold">{order.order_id}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                        已发货
                      </span>
                      {shippedDays !== null && (
                        <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                          已发货{shippedDays}天
                        </span>
                      )}
                    </div>
                  </div>

                  {isOverdue && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-red-700 font-medium text-sm">
                        ⚠️ 该订单已发货超过5天，请跟进物流进度
                      </p>
                    </div>
                  )}

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
            );
          })}
        </div>
      )}

      {/* 批量填写快递单号弹窗 */}
      {showBatchTrackingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4">批量填写快递单号</h2>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                请粘贴快递信息，每行一条，格式：快递单号 收货人姓名 其他信息
              </p>
              <p className="text-sm text-gray-500 mb-3">
                示例：SF3274601602023 鲍剑 DURANT 32+
              </p>

              <textarea
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm"
                rows={10}
                placeholder="SF3274601602023 鲍剑 DURANT 32+&#10;SF3274601602024 张三 DURANT 34+&#10;SF3274601602025 李四 DURANT 36+"
                value={batchTrackingText}
                onChange={(e) => setBatchTrackingText(e.target.value)}
              />

              <p className="text-xs text-gray-500 mt-2">
                ⚠️ 注意：快递单号必须以SF开头，系统将自动匹配收货人姓名
              </p>
            </div>

            <div className="flex gap-2">
              <Button fullWidth onClick={handleBatchTracking}>
                开始填写
              </Button>
              <Button
                fullWidth
                variant="secondary"
                onClick={() => {
                  setShowBatchTrackingModal(false);
                  setBatchTrackingText('');
                }}
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
