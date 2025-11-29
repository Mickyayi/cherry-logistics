-- 创建订单表
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mall_order_no TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    items TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    tracking_number TEXT,
    created_at INTEGER NOT NULL
);

