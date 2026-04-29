from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from database import get_db
from models import QALog, KnowledgeBase, QASystem, User, DocumentUpload
from schemas import DashboardStats, SystemStats
from auth import get_current_user, require_admin
from datetime import datetime, timedelta
from typing import List, Optional

router = APIRouter(prefix="/api/stats", tags=["数据统计"])


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard_stats(
    range_days: int = Query(30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kb_count = (await db.execute(select(func.count()).select_from(KnowledgeBase))).scalar() or 0
    doc_count = (await db.execute(select(func.count()).select_from(DocumentUpload))).scalar() or 0
    system_count = (await db.execute(select(func.count()).select_from(QASystem))).scalar() or 0
    user_count = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    question_count = (await db.execute(select(func.count()).select_from(QALog))).scalar() or 0

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_questions = (
        await db.execute(select(func.count()).where(QALog.created_at >= today))
    ).scalar() or 0

    since = datetime.utcnow() - timedelta(days=range_days)
    kb_hits = (
        await db.execute(
            select(func.count()).where(
                QALog.created_at >= since, QALog.source.in_(["kb", "rule_match"])
            )
        )
    ).scalar() or 0
    total_in_range = (
        await db.execute(select(func.count()).where(QALog.created_at >= since))
    ).scalar() or 0
    kb_hit_rate = round(kb_hits / total_in_range * 100, 1) if total_in_range > 0 else 0.0

    web_searches = (
        await db.execute(
            select(func.count()).where(QALog.created_at >= since, QALog.source == "web")
        )
    ).scalar() or 0
    web_search_rate = round(web_searches / total_in_range * 100, 1) if total_in_range > 0 else 0.0

    return DashboardStats(
        kb_count=kb_count,
        doc_count=doc_count,
        system_count=system_count,
        user_count=user_count,
        question_count=question_count,
        today_questions=today_questions,
        kb_hit_rate=kb_hit_rate,
        web_search_rate=web_search_rate,
    )


@router.get("/systems", response_model=List[SystemStats])
async def system_stats(
    range_days: int = Query(30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=range_days)
    systems = (await db.execute(select(QASystem))).scalars().all()
    result = []
    for sys in systems:
        q_count = (
            await db.execute(
                select(func.count()).where(QALog.system_id == sys.id, QALog.created_at >= since)
            )
        ).scalar() or 0
        kb_hits = (
            await db.execute(
                select(func.count()).where(
                    QALog.system_id == sys.id,
                    QALog.created_at >= since,
                    QALog.source.in_(["kb", "rule_match"]),
                )
            )
        ).scalar() or 0
        web_count = (
            await db.execute(
                select(func.count()).where(
                    QALog.system_id == sys.id,
                    QALog.created_at >= since,
                    QALog.source == "web",
                )
            )
        ).scalar() or 0
        kb_hit_rate = round(kb_hits / q_count * 100, 1) if q_count > 0 else 0.0
        result.append(
            SystemStats(
                system_id=sys.id,
                system_name=sys.name,
                visit_count=q_count,
                question_count=q_count,
                kb_hit_count=kb_hits,
                web_search_count=web_count,
                kb_hit_rate=kb_hit_rate,
            )
        )
    return result


@router.get("/trend")
async def question_trend(
    range_days: int = Query(30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=range_days)
    logs = (
        await db.execute(
            select(QALog.created_at, QALog.source).where(QALog.created_at >= since)
        )
    ).all()

    daily = {}
    for created_at, source in logs:
        day = created_at.strftime("%Y-%m-%d")
        if day not in daily:
            daily[day] = {"total": 0, "kb": 0, "web": 0, "rule": 0}
        daily[day]["total"] += 1
        if source in ("kb", "rule_match"):
            daily[day]["kb"] += 1
        elif source == "web":
            daily[day]["web"] += 1
        else:
            daily[day]["rule"] += 1

    sorted_days = sorted(daily.keys())
    return {
        "dates": sorted_days,
        "total": [daily[d]["total"] for d in sorted_days],
        "kb": [daily[d]["kb"] for d in sorted_days],
        "web": [daily[d]["web"] for d in sorted_days],
        "rule": [daily[d]["rule"] for d in sorted_days],
    }
