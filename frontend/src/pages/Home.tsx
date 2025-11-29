import { useNavigate } from 'react-router-dom';
import { Button, PageContainer, Card } from '../components/UI';

export default function Home() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🍒</h1>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">车厘子物流查询</h1>
        <p className="text-gray-600">欢迎使用车厘子团购物流系统</p>
      </div>

      <div className="space-y-4">
        <Card>
          <Button
            fullWidth
            size="lg"
            onClick={() => navigate('/submit')}
          >
            📝 提交物流信息
          </Button>
        </Card>

        <Card>
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            onClick={() => navigate('/check')}
          >
            🔍 查看物流状态
          </Button>
        </Card>
      </div>

    </PageContainer>
  );
}

