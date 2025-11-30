-- 车厘子物流系统数据库表结构
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mall_order_no TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    items TEXT NOT NULL,  -- JSON 字符串存储商品列表
    status TEXT NOT NULL DEFAULT 'pending',  -- pending/reviewed/shipped/completed
    tracking_number TEXT,
    shipped_at INTEGER,  -- 快递单号填写时间戳
    created_at INTEGER NOT NULL
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_recipient_info ON orders(recipient_name, recipient_phone);
CREATE INDEX IF NOT EXISTS idx_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_created_at ON orders(created_at DESC);

