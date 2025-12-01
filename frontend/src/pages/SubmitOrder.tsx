import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Select, PageContainer, Card } from '../components/UI';
import { createOrder, type CherryItem } from '../api';
import { CHERRY_VARIETIES, CHERRY_SIZES } from '../config';

export default function SubmitOrder() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    mall_order_no: '',
    recipient_name: '',
    recipient_phone: '',
    recipient_address: '',
  });
  const [items, setItems] = useState<CherryItem[]>([
    { variety: '', size: '', boxes: 1 },
  ]);

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleItemChange = (index: number, field: keyof CherryItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { variety: '', size: '', boxes: 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证
    if (!formData.mall_order_no || !formData.recipient_name || !formData.recipient_phone || !formData.recipient_address) {
      alert('请填写所有必填项');
      return;
    }

    if (items.some(item => !item.variety || !item.size || !item.boxes || (typeof item.boxes === 'number' && item.boxes < 1))) {
      alert('请完整填写商品信息');
      return;
    }

    setLoading(true);
    try {
      const result = await createOrder({
        ...formData,
        items: items.map(item => ({
          ...item,
          boxes: typeof item.boxes === 'string' ? parseInt(item.boxes) : item.boxes
        })),
      });
      alert(`订单提交成功！订单号：${result.order_id}`);
      navigate('/');
    } catch (error: any) {
      alert(`提交失败：${error.message}`);
    } finally {
      setLoading(false);
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
        <h1 className="text-2xl font-bold text-gray-800 mt-2">提交物流信息</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="1. 好鲜生商城订单号"
            placeholder="请输入订单号"
            value={formData.mall_order_no}
            onChange={(e) => handleInputChange('mall_order_no', e.target.value)}
            required
          />

          <Input
            label="2. 国内收货人姓名"
            placeholder="请输入姓名"
            value={formData.recipient_name}
            onChange={(e) => handleInputChange('recipient_name', e.target.value)}
            required
          />

          <Input
            label="3. 国内收货人电话"
            type="tel"
            placeholder="请输入电话号码"
            value={formData.recipient_phone}
            onChange={(e) => handleInputChange('recipient_phone', e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              4. 国内收货人地址（包括邮编）
            </label>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows={3}
              placeholder="请输入完整地址和邮编"
              value={formData.recipient_address}
              onChange={(e) => handleInputChange('recipient_address', e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              5. 樱桃品种和数量
            </label>
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">商品 {index + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-600 text-sm hover:underline"
                      >
                        删除
                      </button>
                    )}
                  </div>

                  <Select
                    label="樱桃品种"
                    value={item.variety}
                    onChange={(e) => handleItemChange(index, 'variety', e.target.value)}
                    options={CHERRY_VARIETIES.map(v => ({ value: v, label: v }))}
                    required
                  />

                  <Select
                    label="大小"
                    value={item.size}
                    onChange={(e) => handleItemChange(index, 'size', e.target.value)}
                    options={CHERRY_SIZES.map(s => ({ value: s, label: s }))}
                    required
                  />

                  <Input
                    label="箱数"
                    type="number"
                    min="1"
                    value={item.boxes}
                    onChange={(e) => {
                      const value = e.target.value;
                      // 允许空值或者有效的数字
                      if (value === '' || value === '0') {
                        handleItemChange(index, 'boxes', '');
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num > 0) {
                          handleItemChange(index, 'boxes', num);
                        }
                      }
                    }}
                    required
                  />
                </div>
              ))}

              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={addItem}
              >
                + 添加更多商品
              </Button>
            </div>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              fullWidth
              size="lg"
              disabled={loading}
            >
              {loading ? '提交中...' : '提交订单'}
            </Button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}

