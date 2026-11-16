from typing import Any

import jwt
from fastapi import Header, HTTPException

from app.core.settings import JWT_SECRET


def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any] | None:
    if not authorization:
        return None
    if not authorization.startswith("Bearer ") or not JWT_SECRET:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        return jwt.decode(
            authorization[7:], JWT_SECRET, algorithms=["HS256"],
            issuer="fashion-auth", options={"require": ["sub", "exp", "iss"]}
        )
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=401, detail="Invalid token") from error


def admin_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = current_user(authorization)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    if "ADMIN" not in user.get("groups", []):
        raise HTTPException(status_code=403, detail="Admin role required")
    return user
