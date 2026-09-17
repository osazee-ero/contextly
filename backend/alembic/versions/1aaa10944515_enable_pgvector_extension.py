"""enable pgvector extension

Revision ID: 1aaa10944515
Revises: 316829e5503c
Create Date: 2026-09-04 13:37:32.783919

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1aaa10944515'
down_revision: Union[str, Sequence[str], None] = '316829e5503c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS vector")
