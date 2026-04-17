"""add expires_at and ocr task type

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add 'ocr' to the task_type ENUM
    # Note: Postgres ALTER TYPE ADD VALUE cannot run inside a transaction.
    # Alembic handles this by splitting the command if supported, 
    # but here we use a raw SQL command with COMMIT.
    op.execute("COMMIT")
    op.execute("ALTER TYPE task_type ADD VALUE 'ocr'")

    # 2. Add expires_at column to processed_files
    op.add_column(
        "processed_files",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True)
    )

    # 3. Backfill expires_at for existing records (7 days after creation)
    op.execute("UPDATE processed_files SET expires_at = created_at + interval '7 days'")

    # 4. Enforce non-nullable and create index
    op.alter_column("processed_files", "expires_at", nullable=False)
    op.create_index(
        op.f("ix_processed_files_expires_at"), 
        "processed_files", 
        ["expires_at"], 
        unique=False
    )


def downgrade() -> None:
    # 1. Remove index and column
    op.drop_index(op.f("ix_processed_files_expires_at"), table_name="processed_files")
    op.drop_column("processed_files", "expires_at")
    
    # 2. Reverting ENUM values in Postgres is complex as it requires 
    # recreating the type. We typically leave the value in for safety.
