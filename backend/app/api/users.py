from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me", response_model=UserOut)
async def update_user_me(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if update_data.password:
        if not update_data.current_password or not verify_password(
            update_data.current_password, current_user.hashed_password
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid current password",
            )
        current_user.hashed_password = hash_password(update_data.password)

    if update_data.full_name is not None:
        current_user.full_name = update_data.full_name

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user
