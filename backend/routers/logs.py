from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete
from database import get_db
from models import QALog, QASession, QASystem, User
from auth import get_current_user
from datetime import datetime, timedelta
from typing import Optional
import json

router = APIRouter(prefix="/api/admin/logs", tags=["问答日志"])


@router.get("")
async def list_qa_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    system_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(QALog).order_by(QALog.created_at.desc())
    count_q = select(func.count()).select_from(QALog)

    if system_id:
        q = q.where(QALog.system_id == system_id)
        count_q = count_q.where(QALog.system_id == system_id)
    if user_id:
        q = q.where(QALog.user_id == user_id)
        count_q = count_q.where(QALog.user_id == user_id)
    if keyword:
        kw = f"%{keyword}%"
        q = q.where(QALog.question.ilike(kw))
        count_q = count_q.where(QALog.question.ilike(kw))
    if start_date:
        try:
            sd = datetime.fromisoformat(start_date)
            q = q.where(QALog.created_at >= sd)
            count_q = count_q.where(QALog.created_at >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            ed = datetime.fromisoformat(end_date) + timedelta(days=1)
            q = q.where(QALog.created_at < ed)
            count_q = count_q.where(QALog.created_at < ed)
        except ValueError:
            pass

    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * page_size
    q = q.offset(offset).limit(page_size)
    result = await db.execute(q)
    logs = result.scalars().all()

    system_ids = list(set(l.system_id for l in logs))
    user_ids = list(set(l.user_id for l in logs if l.user_id))

    systems = {}
    if system_ids:
        sys_result = await db.execute(select(QASystem).where(QASystem.id.in_(system_ids)))
        for s in sys_result.scalars().all():
            systems[s.id] = s.name

    users = {}
    if user_ids:
        user_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        for u in user_result.scalars().all():
            users[u.id] = u.username

    items = []
    for l in logs:
        refs = []
        if l.references:
            try:
                refs = json.loads(l.references)
            except (json.JSONDecodeError, TypeError):
                refs = []
        items.append({
            "id": l.id,
            "system_id": l.system_id,
            "system_name": systems.get(l.system_id, "未知系统"),
            "user_id": l.user_id,
            "username": users.get(l.user_id, "匿名用户") if l.user_id else "匿名用户",
            "question": l.question,
            "answer": l.answer or "",
            "mode": l.mode,
            "source": l.source,
            "latency_ms": l.latency_ms,
            "feedback": l.feedback,
            "references": refs,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.get("/systems/list")
async def list_systems_for_filter(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(QASystem))
    systems = [{"id": s.id, "name": s.name} for s in result.scalars().all()]
    return {"systems": systems}


@router.get("/users/list")
async def list_users_for_filter(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User))
    users = [{"id": u.id, "username": u.username} for u in result.scalars().all()]
    return {"users": users}


@router.delete("/clear")
async def clear_qa_logs(
    system_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = delete(QALog)
    if system_id:
        q = q.where(QALog.system_id == system_id)
    if user_id:
        q = q.where(QALog.user_id == user_id)
    if keyword:
        kw = f"%{keyword}%"
        q = q.where(QALog.question.ilike(kw))
    if start_date:
        try:
            sd = datetime.fromisoformat(start_date)
            q = q.where(QALog.created_at >= sd)
        except ValueError:
            pass
    if end_date:
        try:
            ed = datetime.fromisoformat(end_date) + timedelta(days=1)
            q = q.where(QALog.created_at < ed)
        except ValueError:
            pass

    result = await db.execute(q)
    await db.commit()
    return {"message": f"已清空 {result.rowcount} 条问答日志"}
