-- 创建索引
CREATE INDEX IF NOT EXISTS idx_recipient_info ON orders(recipient_name, recipient_phone);
CREATE INDEX IF NOT EXISTS idx_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON orders(created_at DESC);

