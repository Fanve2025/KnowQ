from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import Conversation, QALog, User
from auth import get_current_user_optional
from pydantic import BaseModel
from typing import Optional


router = APIRouter(prefix="/api/qa/conversations", tags=["对话管理"])


class CreateConversationRequest(BaseModel):
    system_id: str
    title: Optional[str] = None


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None


@router.get("")
async def list_conversations(
    system_id: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    if not current_user:
        return {"conversations": []}

    q = (
        select(Conversation)
        .where(Conversation.system_id == system_id, Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
    )
    result = await db.execute(q)
    conversations = result.scalars().all()

    items = []
    for c in conversations:
        count_result = await db.execute(
            select(func.count()).select_from(QALog).where(QALog.conversation_id == c.id)
        )
        msg_count = count_result.scalar() or 0
        items.append({
            "id": c.id,
            "title": c.title or "新对话",
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            "message_count": msg_count,
        })

    return {"conversations": items}


@router.post("")
async def create_conversation(
    req: CreateConversationRequest,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    conversation = Conversation(
        system_id=req.system_id,
        user_id=current_user.id if current_user else None,
        title=req.title or "新对话",
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
    }


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")

    if current_user and conv.user_id and conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此对话")

    log_result = await db.execute(
        select(QALog)
        .where(QALog.conversation_id == conversation_id)
        .order_by(QALog.created_at.asc())
    )
    logs = log_result.scalars().all()

    import json
    messages = []
    for l in logs:
        refs = []
        if l.references:
            try:
                refs = json.loads(l.references)
            except (json.JSONDecodeError, TypeError):
                refs = []
        messages.append({
            "id": l.id,
            "question": l.question,
            "answer": l.answer or "",
            "source": l.source,
            "mode": l.mode,
            "latency_ms": l.latency_ms,
            "feedback": l.feedback,
            "references": refs,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        })

    return {
        "id": conv.id,
        "title": conv.title,
        "system_id": conv.system_id,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "messages": messages,
    }


@router.put("/{conversation_id}")
async def update_conversation(
    conversation_id: str,
    req: UpdateConversationRequest,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")

    if current_user and conv.user_id and conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改此对话")

    if req.title is not None:
        conv.title = req.title
    await db.commit()
    return {"id": conv.id, "title": conv.title}


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")

    if current_user and conv.user_id and conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除此对话")

    log_result = await db.execute(
        select(QALog).where(QALog.conversation_id == conversation_id)
    )
    for log in log_result.scalars().all():
        log.conversation_id = None

    await db.delete(conv)
    await db.commit()
    return {"message": "对话已删除"}
