import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, PageContainer, Card, Loading } from '../components/UI';
import { searchOrders, queryTracking, type Order, type TrackingInfo } from '../api';
import { ORDER_STATUS } from '../config';

export default function CheckOrder() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [searched, setSearched] = useState(false);
  const [trackingInfo, setTrackingInfo] = useState<{ [key: string]: TrackingInfo }>({});
  const [loadingTracking, setLoadingTracking] = useState<{ [key: string]: boolean }>({});

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !phone) {
      alert('请输入姓名和电话');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const result = await searchOrders(name, phone);
      setOrders(result.orders);
      setTrackingInfo({});
    } catch (error: any) {
      alert(`查询失败：${error.message}`);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryTracking = async (trackingNumber: string, recipientPhone: string) => {
    setLoadingTracking({ ...loadingTracking, [trackingNumber]: true });
    try {
      const result = await queryTracking(trackingNumber, recipientPhone);
      setTrackingInfo({ ...trackingInfo, [trackingNumber]: result });
    } catch (error: any) {
      alert(`物流查询失败：${error.message}`);
    } finally {
      setLoadingTracking({ ...loadingTracking, [trackingNumber]: false });
    }
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:underline text-sm"
        >
          ← 返回首页
        </button>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">查看物流状态</h1>
      </div>

      <Card className="mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <Input
            label="收货人姓名"
            placeholder="请输入姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="收货人电话"
            type="tel"
            placeholder="请输入电话号码"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

          <Button type="submit" fullWidth size="lg" disabled={loading}>
            {loading ? '查询中...' : '查询'}
          </Button>
        </form>
      </Card>

      {loading && <Loading />}

      {!loading && searched && orders.length === 0 && (
        <Card>
          <p className="text-center text-gray-600">未找到匹配的订单</p>
        </Card>
      )}

      {!loading && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-600">订单号</p>
                    <p className="font-semibold">{order.order_id}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      order.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : order.status === 'shipped'
                        ? 'bg-blue-100 text-blue-700'
                        : order.status === 'reviewed'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {ORDER_STATUS[order.status as keyof typeof ORDER_STATUS] || order.status}
                  </span>
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm text-gray-600">商城订单号</p>
                  <p className="font-medium">{order.mall_order_no}</p>
                </div>

                {order.tracking_number ? (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm text-gray-600">快递单号</p>
                      {!trackingInfo[order.tracking_number] && (
                        <Button
                          size="sm"
                          onClick={() => handleQueryTracking(order.tracking_number!, order.recipient_phone)}
                          disabled={loadingTracking[order.tracking_number]}
                        >
                          {loadingTracking[order.tracking_number] ? '查询中...' : '查看物流'}
                        </Button>
                      )}
                    </div>
                    <p className="font-semibold text-blue-700 mb-2">{order.tracking_number}</p>

                    {/* 物流轨迹 */}
                    {trackingInfo[order.tracking_number] && (
                      <div className="mt-3 border-t border-blue-200 pt-3">
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-sm font-medium text-blue-900">
                            {trackingInfo[order.tracking_number].company} - {trackingInfo[order.tracking_number].state_text}
                          </p>
                          <button
                            onClick={() => {
                              const newTracking = { ...trackingInfo };
                              delete newTracking[order.tracking_number!];
                              setTrackingInfo(newTracking);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            收起
                          </button>
                        </div>
                        
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {trackingInfo[order.tracking_number].data.map((item, idx) => (
                            <div key={idx} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div className={`w-3 h-3 rounded-full ${idx === 0 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                                {idx !== trackingInfo[order.tracking_number].data.length - 1 && (
                                  <div className="w-0.5 flex-1 bg-gray-300 my-1"></div>
                                )}
                              </div>
                              <div className="flex-1 pb-3">
                                <p className={`text-xs ${idx === 0 ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                                  {item.ftime}
                                </p>
                                <p className={`text-sm mt-1 ${idx === 0 ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                                  {item.context}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  !order.tracking_number && order.status !== 'pending' && (
                    <div className="bg-gray-50 p-3 rounded-lg text-center text-sm text-gray-600">
                      快递单号暂未填写
                    </div>
                  )
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
