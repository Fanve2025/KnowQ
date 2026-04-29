from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import QASystem, QALog, QASession, Conversation, LLMConfig, SearchConfig, KnowledgeEntry, User, SystemSettings
from schemas import AskRequest, AskResponse, FeedbackRequest
from auth import decrypt_api_key, verify_password, create_access_token, get_current_user_optional, get_current_user
from datetime import datetime
import json
import time

router = APIRouter(prefix="/api/qa", tags=["前端问答"])


@router.post("/login")
async def qa_login(
    username: str,
    password: str,
    system_id: str = "",
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="账号已被禁用")

    settings_result = await db.execute(select(SystemSettings).limit(1))
    settings = settings_result.scalar_one_or_none()
    expire_hours = settings.token_expire_hours if settings else None

    token = create_access_token({"sub": user.id, "role": user.role}, expire_hours=expire_hours)

    session_id = None
    if system_id:
        session = QASession(
            system_id=system_id,
            user_id=user.id,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        session_id = session.id

    return {
        "access_token": token,
        "session_id": session_id,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
        },
    }


@router.post("/auto-login")
async def qa_auto_login(
    system_id: str = "",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings_result = await db.execute(select(SystemSettings).limit(1))
    settings = settings_result.scalar_one_or_none()
    expire_hours = settings.token_expire_hours if settings else None

    session_id = None
    if system_id:
        session = QASession(
            system_id=system_id,
            user_id=current_user.id,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        session_id = session.id

    token = create_access_token({"sub": current_user.id, "role": current_user.role}, expire_hours=expire_hours)

    return {
        "access_token": token,
        "session_id": session_id,
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "role": current_user.role,
        },
    }


@router.post("/logout")
async def qa_logout(
    session_id: str = "",
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    if session_id:
        result = await db.execute(select(QASession).where(QASession.id == session_id))
        session = result.scalar_one_or_none()
        if session and not session.logout_at:
            session.logout_at = datetime.utcnow()
            await db.commit()
    return {"message": "登出成功"}


@router.get("/{system_id}/config")
async def get_system_config(
    system_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(QASystem).where(QASystem.id == system_id))
    system = result.scalar_one_or_none()
    if not system:
        raise HTTPException(status_code=404, detail="问答系统不存在")
    if system.status != "active":
        raise HTTPException(status_code=403, detail="该问答系统已停用")
    return {
        "id": system.id,
        "name": system.name,
        "mode": system.mode,
        "welcome_message": system.welcome_message,
        "has_password": bool(system.access_password),
    }


@router.post("/{system_id}/verify-password")
async def verify_password(
    system_id: str,
    password: str = "",
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(QASystem).where(QASystem.id == system_id))
    system = result.scalar_one_or_none()
    if not system:
        raise HTTPException(status_code=404, detail="问答系统不存在")
    if system.access_password and system.access_password != password:
        raise HTTPException(status_code=403, detail="访问密码错误")
    return {"verified": True}


@router.post("/{system_id}/ask")
async def ask_question(
    system_id: str,
    req: AskRequest,
    session_id: str = "",
    conversation_id: str = "",
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(QASystem).where(QASystem.id == system_id))
    system = result.scalar_one_or_none()
    if not system:
        raise HTTPException(status_code=404, detail="问答系统不存在")
    if system.status != "active":
        raise HTTPException(status_code=403, detail="该问答系统已停用")

    start_time = time.time()
    kb_ids = json.loads(system.kb_ids) if system.kb_ids else []

    try:
        if system.mode == "ai":
            answer, source, references = await _handle_ai_mode(system, kb_ids, req, db)
        else:
            answer, source, references = await _handle_rule_mode(system, kb_ids, req, db)
    except Exception as e:
        answer = f"抱歉，处理您的问题时出现错误：{str(e)}"
        source = "error"
        references = []

    latency_ms = int((time.time() - start_time) * 1000)

    conv_id = conversation_id if conversation_id else None
    if conv_id:
        conv_result = await db.execute(select(Conversation).where(Conversation.id == conv_id))
        conv = conv_result.scalar_one_or_none()
        if conv and conv.title == "新对话":
            conv.title = req.question[:50]
            conv.updated_at = datetime.utcnow()

    log = QALog(
        session_id=session_id if session_id else None,
        conversation_id=conv_id,
        system_id=system_id,
        user_id=current_user.id if current_user else None,
        question=req.question,
        answer=answer,
        mode=system.mode,
        source=source,
        latency_ms=latency_ms,
        references=json.dumps(references, ensure_ascii=False) if references else None,
    )
    db.add(log)

    if session_id:
        sess_result = await db.execute(select(QASession).where(QASession.id == session_id))
        sess = sess_result.scalar_one_or_none()
        if sess:
            sess.question_count = (sess.question_count or 0) + 1

    await db.commit()
    await db.refresh(log)

    return {
        "answer": answer,
        "source": source,
        "references": references,
        "log_id": log.id,
    }


@router.post("/{system_id}/ask/stream")
async def ask_question_stream(
    system_id: str,
    req: AskRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(QASystem).where(QASystem.id == system_id))
    system = result.scalar_one_or_none()
    if not system:
        raise HTTPException(status_code=404, detail="问答系统不存在")
    if system.status != "active":
        raise HTTPException(status_code=403, detail="该问答系统已停用")

    kb_ids = json.loads(system.kb_ids) if system.kb_ids else []
    start_time = time.time()

    async def generate():
        try:
            if system.mode == "ai":
                async for chunk in _handle_ai_mode_stream(system, kb_ids, req, db):
                    yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            else:
                answer, source, references = await _handle_rule_mode(system, kb_ids, req, db)
                yield f"data: {json.dumps({'type': 'answer', 'content': answer, 'source': source, 'references': references}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

        latency_ms = int((time.time() - start_time) * 1000)
        async with db.begin():
            log = QALog(
                system_id=system_id,
                question=req.question,
                answer="",
                mode=system.mode,
                source="stream",
                latency_ms=latency_ms,
            )
            db.add(log)

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/feedback")
async def submit_feedback(
    req: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(QALog).where(QALog.id == req.log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="日志不存在")
    log.feedback = req.feedback
    await db.commit()
    return {"message": "反馈已提交"}


async def _handle_ai_mode(system, kb_ids, req, db):
    from services.qa_engine import AIEngine
    engine = AIEngine(db, system)
    return await engine.process(req.question, req.history)


async def _handle_ai_mode_stream(system, kb_ids, req, db):
    from services.qa_engine import AIEngine
    engine = AIEngine(db, system)
    async for chunk in engine.process_stream(req.question, req.history):
        yield chunk


async def _handle_rule_mode(system, kb_ids, req, db):
    from services.qa_engine import RuleEngine
    engine = RuleEngine(db, system)
    return await engine.process(req.question)
