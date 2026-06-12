import json
import os
from typing import Annotated

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials

_initialized = False


def init_firebase():
    global _initialized
    if _initialized:
        return

    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "")

    if sa_json:
        cred = credentials.Certificate(json.loads(sa_json))
    elif sa_path and os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
    else:
        raise RuntimeError(
            "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH"
        )

    firebase_admin.initialize_app(cred)
    _initialized = True


bearer = HTTPBearer()


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
) -> dict:
    try:
        decoded = auth.verify_id_token(creds.credentials)
        return decoded
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        )
