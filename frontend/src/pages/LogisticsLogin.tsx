import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, PageContainer, Card } from '../components/UI';
import { authenticate } from '../api';
import { setAuthenticated } from '../utils/auth';

export default function LogisticsLogin() {
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passcode) {
      alert('请输入密码');
      return;
    }

    setLoading(true);
    try {
      await authenticate(passcode, 'logistics');
      setAuthenticated();
      navigate('/logistics');
    } catch (error: any) {
      alert(`登录失败：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800">物流管理登录</h1>
        <p className="text-gray-600 mt-2">请输入管理密码</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="管理密码"
            type="password"
            placeholder="请输入密码"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            required
          />

          <Button type="submit" fullWidth size="lg" disabled={loading}>
            {loading ? '验证中...' : '登录'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-sm text-blue-600 hover:underline"
            >
              返回首页
            </button>
          </div>
        </form>
      </Card>
    </PageContainer>
  );
}

