from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import SearchConfig, User
from schemas import SearchConfigCreate, SearchConfigUpdate, SearchConfigOut
from auth import require_admin, encrypt_api_key, decrypt_api_key
from typing import List

router = APIRouter(prefix="/api/admin/search-config", tags=["联网搜索配置"])


@router.get("/providers")
async def get_providers(current_user: User = Depends(require_admin)):
    from services.search import SEARCH_PROVIDERS
    providers = [{"key": k, "name": v["name"], "key_label": v["key_label"]} for k, v in SEARCH_PROVIDERS.items()]
    return {"providers": providers}


@router.get("", response_model=List[SearchConfigOut])
async def list_configs(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SearchConfig).order_by(SearchConfig.created_at.desc()))
    configs = result.scalars().all()
    out = []
    for c in configs:
        co = SearchConfigOut.model_validate(c)
        if co.api_key_encrypted:
            masked = decrypt_api_key(co.api_key_encrypted)
            co.api_key_encrypted = masked[:4] + "****" + masked[-4:] if len(masked) > 8 else "****"
        out.append(co)
    return out


@router.post("", response_model=SearchConfigOut)
async def create_config(
    req: SearchConfigCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    config = SearchConfig(
        name=req.name,
        provider=req.provider,
        api_key_encrypted=encrypt_api_key(req.api_key) if req.api_key else "",
        endpoint=req.endpoint,
        cx=req.cx,
        max_results=req.max_results,
        summary_length=req.summary_length,
        is_enabled_global=req.is_enabled_global,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return SearchConfigOut.model_validate(config)


@router.put("/{config_id}", response_model=SearchConfigOut)
async def update_config(
    config_id: str,
    req: SearchConfigUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SearchConfig).where(SearchConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    if req.name is not None:
        config.name = req.name
    if req.provider is not None:
        config.provider = req.provider
    if req.api_key is not None:
        config.api_key_encrypted = encrypt_api_key(req.api_key) if req.api_key else ""
    if req.endpoint is not None:
        config.endpoint = req.endpoint
    if req.cx is not None:
        config.cx = req.cx
    if req.max_results is not None:
        config.max_results = req.max_results
    if req.summary_length is not None:
        config.summary_length = req.summary_length
    if req.is_enabled_global is not None:
        config.is_enabled_global = req.is_enabled_global
    await db.commit()
    await db.refresh(config)
    return SearchConfigOut.model_validate(config)


@router.delete("/{config_id}")
async def delete_config(
    config_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SearchConfig).where(SearchConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    await db.delete(config)
    await db.commit()
    return {"message": "删除成功"}


@router.post("/{config_id}/test")
async def test_search(
    config_id: str,
    query: str = "test",
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SearchConfig).where(SearchConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")

    from services.search import SearchClient
    client = SearchClient(config)
    try:
        results = await client.search(query)
        return {"success": True, "results": results}
    except Exception as e:
        return {"success": False, "message": f"搜索失败: {str(e)}"}
