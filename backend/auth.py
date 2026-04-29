from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User

SECRET_KEY = "knowq-secret-key-2026-ai-knowledge-platform"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None, expire_hours: Optional[int] = None) -> str:
    to_encode = data.copy()
    hours = expire_hours or ACCESS_TOKEN_EXPIRE_HOURS
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=hours))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的认证凭据")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的认证凭据")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在或已禁用")
    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user and user.status == "active":
            return user
    except Exception:
        pass
    return None


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return current_user


ENCRYPTION_KEY = b"knowq-2026-ai-kb-qa-platform-enc"


def encrypt_api_key(api_key: str) -> str:
    if not api_key:
        return ""
    from cryptography.fernet import Fernet
    import base64
    key = base64.urlsafe_b64encode(ENCRYPTION_KEY[:32].ljust(32, b'\0'))
    f = Fernet(key)
    return f.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted: str) -> str:
    if not encrypted:
        return ""
    try:
        from cryptography.fernet import Fernet
        import base64
        key = base64.urlsafe_b64encode(ENCRYPTION_KEY[:32].ljust(32, b'\0'))
        f = Fernet(key)
        return f.decrypt(encrypted.encode()).decode()
    except Exception:
        return ""
