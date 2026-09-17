"""Persist actionable document processing errors.

Revision ID: a82e31c49f10
Revises: 73f75c354919
"""
from alembic import op
import sqlalchemy as sa

revision = "a82e31c49f10"
down_revision = "73f75c354919"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("documents", sa.Column("error_message", sa.String(500), nullable=True))


def downgrade():
    op.drop_column("documents", "error_message")
