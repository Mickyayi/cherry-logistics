// API 配置
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export const ORDER_STATUS = {
  pending: '待审核',
  reviewed: '已审核',
  shipped: '已发货',
  completed: '已完成',
} as const;

export const CHERRY_VARIETIES = [
  '考拉车厘子',
  '樱花车厘子',
  'Cherry Hill 红樱桃',
  'Skyla rea 白樱桃',
  '金考拉车厘子',
  '塔州 Reid车厘子',
] as const;

export const CHERRY_SIZES = [
  '28-30mm',
  '30-32mm',
  '32-34mm',
  '34-36mm',
] as const;
