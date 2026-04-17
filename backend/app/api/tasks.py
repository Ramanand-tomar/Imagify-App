import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.services import storage_service
from app.dependencies import get_current_user, get_db
from app.models.processed_file import ProcessedFile
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.task import BatchStatusOut, TaskHistoryItem, TaskHistoryOut, TaskResultOut, TaskStatusOut

router = APIRouter(prefix="/tasks", tags=["tasks"])


async def _get_user_task(db: AsyncSession, task_id: uuid.UUID, user_id: uuid.UUID) -> Task:
    task = (
        await db.execute(select(Task).where(Task.id == task_id, Task.user_id == user_id))
    ).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.get("/history", response_model=TaskHistoryOut)
async def task_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskHistoryOut:
    total = (
        await db.execute(select(func.count()).select_from(Task).where(Task.user_id == user.id))
    ).scalar_one()

    offset = (page - 1) * page_size
    rows = (
        await db.execute(
            select(Task)
            .where(Task.user_id == user.id)
            .order_by(Task.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
    ).scalars().all()

    return TaskHistoryOut(
        items=[TaskHistoryItem.model_validate(t) for t in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{task_id}/status", response_model=TaskStatusOut)
async def task_status(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskStatusOut:
    task = await _get_user_task(db, task_id, user.id)
    return TaskStatusOut.model_validate(task)




@router.get("/{task_id}/result", response_model=TaskResultOut)
async def task_result(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResultOut:
    task = (
        await db.execute(
            select(Task)
            .options(selectinload(Task.processed_file))
            .where(Task.id == task_id, Task.user_id == user.id)
        )
    ).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.status != TaskStatus.SUCCESS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Task is not ready (status={task.status.value})",
        )
    pf: ProcessedFile | None = task.processed_file
    if pf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result file not found")

    expires_in = 3600
    return TaskResultOut(
        task_id=task.id,
        download_url=storage_service.get_signed_url(pf.imagekit_file_path, expire_seconds=expires_in),
        expires_in_seconds=expires_in,
        original_filename=pf.original_filename,
        mime_type=pf.mime_type,
        size_bytes=pf.size_bytes,
    )


@router.get("/batch/{batch_id}/status", response_model=BatchStatusOut)
async def batch_status(
    batch_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tasks = (
        await db.execute(
            select(Task)
            .options(selectinload(Task.processed_file))
            .where(Task.batch_id == batch_id, Task.user_id == user.id)
        )
    ).scalars().all()

    if not tasks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == TaskStatus.SUCCESS)
    failed = sum(1 for t in tasks if t.status == TaskStatus.FAILED)
    pending = total - completed - failed

    results = []
    for t in tasks:
        if t.status == TaskStatus.SUCCESS and t.processed_file:
            pf = t.processed_file
            results.append(TaskResultOut(
                task_id=t.id,
                download_url=storage_service.get_signed_url(pf.imagekit_file_path, expire_seconds=3600),
                expires_in_seconds=3600,
                original_filename=pf.original_filename,
                mime_type=pf.mime_type,
                size_bytes=pf.size_bytes,
            ))

    return BatchStatusOut(
        batch_id=batch_id,
        total=total,
        completed=completed,
        failed=failed,
        pending=pending,
        results=results,
        tasks=[TaskStatusOut.model_validate(t) for t in tasks]
    )
