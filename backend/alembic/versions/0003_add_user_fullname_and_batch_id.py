"""add user fullname and batch id

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-17 14:43:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add full_name to users
    op.add_column('users', sa.Column('full_name', sa.String(length=255), nullable=True))
    
    # Add batch_id to tasks
    op.add_column('tasks', sa.Column('batch_id', sa.UUID(), nullable=True))
    op.create_index('ix_tasks_batch_id', 'tasks', ['batch_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_tasks_batch_id', table_name='tasks')
    op.drop_column('tasks', 'batch_id')
    op.drop_column('users', 'full_name')
