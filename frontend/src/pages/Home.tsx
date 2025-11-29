import { useNavigate } from 'react-router-dom';
import { Button, PageContainer, Card } from '../components/UI';

export default function Home() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">🍒</h1>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">好鲜生商城</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">2026车厘子国内团购</h2>
        <p className="text-gray-600">物流查询系统</p>
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

