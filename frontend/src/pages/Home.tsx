import { useNavigate } from 'react-router-dom';
import { Button, PageContainer, Card } from '../components/UI';

export default function Home() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">🍒</h1>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">好鲜生商城</h1>
        <h2 className="text-xl font-semibold text-red-600 mb-1">2026车厘子国内团购</h2>
        <p className="text-gray-600 text-lg">物流查询系统</p>
      </div>

      <div className="space-y-4 flex flex-col items-center">
        <Card className="w-full max-w-sm">
          <Button
            fullWidth
            size="lg"
            onClick={() => navigate('/submit')}
          >
            📝 提交物流信息
          </Button>
        </Card>

        <Card className="w-full max-w-sm">
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

