from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4
from typing import Literal
from datetime import datetime, timezone

@dataclass
class ResumeTaskPayload:
    resume: str

@dataclass
class JDTaskPayload:
    jd: str
    suggested_tags: list[str]
    extracted_data: dict | None = None

@dataclass
class SyncPayload:
    new_tags: list[str]

TaskPayload = ResumeTaskPayload | JDTaskPayload | SyncPayload

@dataclass
class Task:
    id: str
    type: Literal['resume', 'jd', 'jd_sync']
    status: Literal['pending', 'running', 'completed', 'failed', 'pending-user-input']
    created_at: datetime
    payload: TaskPayload
    started_at: datetime | None = None
    finished_at: datetime | None = None
    output_name: str | None = None
    error: str | None = None

    @classmethod
    def create_resume(cls, payload: ResumeTaskPayload) -> Task:
        return cls(
            id=str(uuid4()),
            type="resume",
            status="pending",
            created_at=datetime.now(timezone.utc),
            payload=payload,
        )

    @classmethod
    def create_jd(cls, payload: JDTaskPayload) -> Task:
        return cls(
            id=str(uuid4()),
            type="jd",
            status="pending",
            created_at=datetime.now(timezone.utc),
            payload=payload,
        )

    @classmethod
    def create_sync(cls, payload: SyncPayload) -> Task:
        return cls(
            id=str(uuid4()),
            type="jd_sync",
            status="pending",
            created_at=datetime.now(timezone.utc),
            payload=payload,
        )