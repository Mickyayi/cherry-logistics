-- 为已有数据库添加 shipped_at 字段
ALTER TABLE orders ADD COLUMN shipped_at INTEGER;
