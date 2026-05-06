from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import LLMConfig, User
from schemas import LLMConfigCreate, LLMConfigUpdate, LLMConfigOut
from auth import require_admin, encrypt_api_key, decrypt_api_key
from typing import List

router = APIRouter(prefix="/api/admin/llm-config", tags=["LLM配置"])

PROVIDERS = [
    "Anthropic", "OpenAI", "Google", "xAI", "DeepSeek",
    "Kimi", "智谱AI", "Minimax", "阿里云", "硅基流动",
    "无问芯穹", "模力方舟", "自定义"
]


@router.get("/providers")
async def get_providers(current_user: User = Depends(require_admin)):
    return {"providers": PROVIDERS}


@router.get("", response_model=List[LLMConfigOut])
async def list_configs(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LLMConfig).order_by(LLMConfig.created_at.desc()))
    configs = result.scalars().all()
    out = []
    for c in configs:
        co = LLMConfigOut.model_validate(c)
        if co.api_key_encrypted:
            masked = decrypt_api_key(co.api_key_encrypted)
            co.api_key_encrypted = masked[:4] + "****" + masked[-4:] if len(masked) > 8 else "****"
        out.append(co)
    return out


@router.post("", response_model=LLMConfigOut)
async def create_config(
    req: LLMConfigCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    config = LLMConfig(
        name=req.name,
        provider=req.provider,
        model_name=req.model_name,
        api_key_encrypted=encrypt_api_key(req.api_key) if req.api_key else "",
        endpoint=req.endpoint,
        params_json=req.params_json,
        is_default=req.is_default,
    )
    if req.is_default:
        existing = await db.execute(select(LLMConfig).where(LLMConfig.is_default == True))
        for ec in existing.scalars().all():
            ec.is_default = False
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return LLMConfigOut.model_validate(config)


@router.put("/{config_id}", response_model=LLMConfigOut)
async def update_config(
    config_id: str,
    req: LLMConfigUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    if req.name is not None:
        config.name = req.name
    if req.provider is not None:
        config.provider = req.provider
    if req.model_name is not None:
        config.model_name = req.model_name
    if req.api_key is not None:
        config.api_key_encrypted = encrypt_api_key(req.api_key) if req.api_key else ""
    if req.endpoint is not None:
        config.endpoint = req.endpoint
    if req.params_json is not None:
        config.params_json = req.params_json
    if req.is_default is not None:
        if req.is_default:
            existing = await db.execute(select(LLMConfig).where(LLMConfig.is_default == True))
            for ec in existing.scalars().all():
                ec.is_default = False
        config.is_default = req.is_default
    await db.commit()
    await db.refresh(config)
    return LLMConfigOut.model_validate(config)


@router.delete("/{config_id}")
async def delete_config(
    config_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    await db.delete(config)
    await db.commit()
    return {"message": "删除成功"}


@router.post("/{config_id}/test")
async def test_connection(
    config_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")

    from services.llm_gateway import LLMGateway
    gateway = LLMGateway(config)
    try:
        response = await gateway.test_connection()
        return {"success": True, "message": f"连接成功: {response}"}
    except Exception as e:
        return {"success": False, "message": f"连接失败: {str(e)}"}
