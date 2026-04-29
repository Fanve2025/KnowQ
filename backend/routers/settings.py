from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import SystemSettings, User
from schemas import SettingsOut, SettingsUpdate
from auth import get_current_user
from services.qa_engine import get_system_settings

router = APIRouter(prefix="/api/admin/settings", tags=["系统设置"])


@router.get("", response_model=SettingsOut)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_system_settings(db)
    return SettingsOut.model_validate(settings)


@router.put("", response_model=SettingsOut)
async def update_settings(
    req: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_system_settings(db)
    update_data = req.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)
    await db.commit()
    await db.refresh(settings)
    return SettingsOut.model_validate(settings)
