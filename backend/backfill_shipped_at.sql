-- 将所有已有快递单号的订单的发货时间设置为 2025-11-29 12:00:00 (UTC+10)
UPDATE orders 
SET shipped_at = 1764352800
WHERE tracking_number IS NOT NULL 
  AND tracking_number != '' 
  AND shipped_at IS NULL;
