from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
from datetime import datetime

app = FastAPI()

# CORS 配置 - 允许前端调用
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境建议改为具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ 数据模型 ============
class CherryItem(BaseModel):
    variety: str  # 考拉车厘子 或 樱花车厘子
    size: str     # 30-32mm, 32-34mm, 34-36mm
    boxes: int    # 箱数

class OrderCreate(BaseModel):
    mall_order_no: str
    recipient_name: str
    recipient_phone: str
    recipient_address: str
    items: List[CherryItem]

class OrderUpdate(BaseModel):
    mall_order_no: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    recipient_address: Optional[str] = None
    items: Optional[List[CherryItem]] = None

class TrackingUpdate(BaseModel):
    tracking_number: str

class AuthRequest(BaseModel):
    passcode: str

# ============ 辅助函数 ============
async def get_db(request: Request):
    """获取 D1 数据库连接"""
    return request.state.DB

def format_order_id(order_id: int) -> str:
    """格式化订单ID为三位数字符串，如 001"""
    return f"{order_id:03d}"

# ============ API 路由 ============

@app.get("/")
async def root():
    return {"message": "Cherry Logistics API", "version": "1.0.0"}

# 用户提交新订单
@app.post("/api/orders")
async def create_order(order: OrderCreate, request: Request):
    db = await get_db(request)
    
    items_json = json.dumps([item.dict() for item in order.items])
    timestamp = int(datetime.now().timestamp())
    
    result = await db.prepare(
        """
        INSERT INTO orders (
            mall_order_no, recipient_name, recipient_phone, 
            recipient_address, items, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
        """
    ).bind(
        order.mall_order_no,
        order.recipient_name,
        order.recipient_phone,
        order.recipient_address,
        items_json,
        timestamp
    ).run()
    
    order_id = result.meta.last_row_id
    
    return {
        "success": True,
        "order_id": format_order_id(order_id),
        "message": "订单提交成功"
    }

# 用户查询订单（通过姓名和电话）
@app.get("/api/orders/search")
async def search_order(name: str, phone: str, request: Request):
    db = await get_db(request)
    
    result = await db.prepare(
        """
        SELECT id, mall_order_no, status, tracking_number, created_at
        FROM orders
        WHERE recipient_name = ? AND recipient_phone = ?
        ORDER BY created_at DESC
        """
    ).bind(name, phone).all()
    
    if not result.results:
        raise HTTPException(status_code=404, detail="未找到匹配的订单")
    
    orders = []
    for row in result.results:
        orders.append({
            "order_id": format_order_id(row["id"]),
            "mall_order_no": row["mall_order_no"],
            "status": row["status"],
            "status_text": {
                "pending": "待审核",
                "reviewed": "已审核",
                "shipped": "已发货",
                "completed": "已完成"
            }.get(row["status"], "未知"),
            "tracking_number": row["tracking_number"],
            "created_at": row["created_at"]
        })
    
    return {"orders": orders}

# 管理端获取订单列表（带筛选）
@app.get("/api/orders")
async def get_orders(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    request: Request = None
):
    db = await get_db(request)
    offset = (page - 1) * limit
    
    if status:
        query = """
            SELECT * FROM orders 
            WHERE status = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        """
        result = await db.prepare(query).bind(status, limit, offset).all()
    else:
        query = """
            SELECT * FROM orders 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        """
        result = await db.prepare(query).bind(limit, offset).all()
    
    orders = []
    for row in result.results:
        orders.append({
            "id": row["id"],
            "order_id": format_order_id(row["id"]),
            "mall_order_no": row["mall_order_no"],
            "recipient_name": row["recipient_name"],
            "recipient_phone": row["recipient_phone"],
            "recipient_address": row["recipient_address"],
            "items": json.loads(row["items"]),
            "status": row["status"],
            "tracking_number": row["tracking_number"],
            "created_at": row["created_at"]
        })
    
    return {"orders": orders, "page": page, "limit": limit}

# 客服修改订单信息
@app.put("/api/orders/{order_id}")
async def update_order(order_id: int, order: OrderUpdate, request: Request):
    db = await get_db(request)
    
    updates = []
    values = []
    
    if order.mall_order_no is not None:
        updates.append("mall_order_no = ?")
        values.append(order.mall_order_no)
    if order.recipient_name is not None:
        updates.append("recipient_name = ?")
        values.append(order.recipient_name)
    if order.recipient_phone is not None:
        updates.append("recipient_phone = ?")
        values.append(order.recipient_phone)
    if order.recipient_address is not None:
        updates.append("recipient_address = ?")
        values.append(order.recipient_address)
    if order.items is not None:
        updates.append("items = ?")
        values.append(json.dumps([item.dict() for item in order.items]))
    
    if not updates:
        raise HTTPException(status_code=400, detail="没有提供需要更新的字段")
    
    values.append(order_id)
    query = f"UPDATE orders SET {', '.join(updates)} WHERE id = ?"
    
    await db.prepare(query).bind(*values).run()
    
    return {"success": True, "message": "订单更新成功"}

# 更新订单状态（审核通过/发货确认）
@app.put("/api/orders/{order_id}/status")
async def update_order_status(order_id: int, status: str, request: Request):
    db = await get_db(request)
    
    valid_statuses = ["pending", "reviewed", "shipped", "completed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="无效的状态值")
    
    await db.prepare(
        "UPDATE orders SET status = ? WHERE id = ?"
    ).bind(status, order_id).run()
    
    return {"success": True, "message": "状态更新成功"}

# 物流回填快递单号
@app.put("/api/orders/{order_id}/tracking")
async def update_tracking(order_id: int, tracking: TrackingUpdate, request: Request):
    db = await get_db(request)
    
    await db.prepare(
        "UPDATE orders SET tracking_number = ? WHERE id = ?"
    ).bind(tracking.tracking_number, order_id).run()
    
    return {"success": True, "message": "快递单号更新成功"}

# 管理端鉴权（简单密码验证）
@app.post("/api/auth")
async def authenticate(auth: AuthRequest):
    ADMIN_PASSCODE = "8888"  # 预设密码
    
    if auth.passcode == ADMIN_PASSCODE:
        return {"success": True, "message": "验证成功"}
    else:
        raise HTTPException(status_code=401, detail="密码错误")

# Cloudflare Workers 入口
async def on_fetch(request, env):
    import asgi
    return await asgi.fetch(app, request, env)

