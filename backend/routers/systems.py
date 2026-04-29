from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import QASystem, LLMConfig, SearchConfig, User
from schemas import SystemCreate, SystemUpdate, SystemOut
from auth import get_current_user, require_admin
from typing import List
import json

router = APIRouter(prefix="/api/admin/systems", tags=["问答系统管理"])


@router.get("", response_model=List[SystemOut])
async def list_systems(
    keyword: str = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(QASystem).order_by(QASystem.created_at.desc())
    if keyword:
        q = q.where(QASystem.name.contains(keyword))
    result = await db.execute(q)
    systems = result.scalars().all()
    return [SystemOut.model_validate(s) for s in systems]


@router.post("", response_model=SystemOut)
async def create_system(
    req: SystemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    system = QASystem(
        name=req.name,
        description=req.description,
        kb_ids=json.dumps(req.kb_ids),
        mode=req.mode,
        llm_config_id=req.llm_config_id,
        search_config_id=req.search_config_id,
        enable_web_search=req.enable_web_search,
        access_password=req.access_password,
        welcome_message=req.welcome_message,
        system_prompt=req.system_prompt,
    )
    db.add(system)
    await db.commit()
    await db.refresh(system)
    system.frontend_url = f"/qa/{system.id}"
    await db.commit()
    await db.refresh(system)
    return SystemOut.model_validate(system)


@router.get("/{system_id}", response_model=SystemOut)
async def get_system(
    system_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(QASystem).where(QASystem.id == system_id))
    system = result.scalar_one_or_none()
    if not system:
        raise HTTPException(status_code=404, detail="问答系统不存在")
    return SystemOut.model_validate(system)


@router.put("/{system_id}", response_model=SystemOut)
async def update_system(
    system_id: str,
    req: SystemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(QASystem).where(QASystem.id == system_id))
    system = result.scalar_one_or_none()
    if not system:
        raise HTTPException(status_code=404, detail="问答系统不存在")
    if req.name is not None:
        system.name = req.name
    if req.description is not None:
        system.description = req.description
    if req.kb_ids is not None:
        system.kb_ids = json.dumps(req.kb_ids)
    if req.mode is not None:
        system.mode = req.mode
    if req.llm_config_id is not None:
        system.llm_config_id = req.llm_config_id
    if req.search_config_id is not None:
        system.search_config_id = req.search_config_id
    if req.enable_web_search is not None:
        system.enable_web_search = req.enable_web_search
    if req.status is not None:
        system.status = req.status
    if req.access_password is not None:
        system.access_password = req.access_password
    if req.welcome_message is not None:
        system.welcome_message = req.welcome_message
    if req.system_prompt is not None:
        system.system_prompt = req.system_prompt
    await db.commit()
    await db.refresh(system)
    return SystemOut.model_validate(system)


@router.delete("/{system_id}")
async def delete_system(
    system_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(QASystem).where(QASystem.id == system_id))
    system = result.scalar_one_or_none()
    if not system:
        raise HTTPException(status_code=404, detail="问答系统不存在")
    await db.delete(system)
    await db.commit()
    return {"message": "删除成功"}
