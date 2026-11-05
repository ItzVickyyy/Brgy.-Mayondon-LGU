"""Request and response shapes for the lookup and officials APIs.

The tables themselves live in ``models_foundation.py``.
"""

import uuid
from datetime import date
from typing import Self

from pydantic import field_validator, model_validator
from sqlmodel import Field, SQLModel


def _clean_name(value: str) -> str:
    """Trim and collapse inner whitespace so ``"Rizal  St. "`` equals ``"Rizal St."``."""
    return " ".join(value.split())


class LookupItem(SQLModel):
    id: int
    name: str


class DocumentTypePublic(SQLModel):
    id: int
    code: str
    name: str
    category: str
    print_mode: str
    validity_months: int | None
    one_per_resident: bool
    signatory_default_position: str | None


class LookupNameIn(SQLModel):
    """Body for adding or renaming a street or tricycle association."""

    name: str = Field(min_length=1, max_length=150)

    @field_validator("name")
    @classmethod
    def _tidy(cls, value: str) -> str:
        value = _clean_name(value)
        if not value:
            raise ValueError("Name must not be empty")
        return value


class OfficialPublic(SQLModel):
    id: uuid.UUID
    full_name: str
    position: str
    term_start: date
    term_end: date | None
    is_elected: bool
    is_current: bool


class OfficialCreate(SQLModel):
    full_name: str = Field(min_length=1, max_length=255)
    position: str = Field(min_length=1, max_length=100)
    term_start: date
    term_end: date | None = None
    is_elected: bool = False
    is_current: bool = True

    @field_validator("full_name", "position")
    @classmethod
    def _tidy(cls, value: str) -> str:
        value = _clean_name(value)
        if not value:
            raise ValueError("Value must not be empty")
        return value

    @model_validator(mode="after")
    def _term_order(self) -> Self:
        if self.term_end is not None and self.term_end < self.term_start:
            raise ValueError("term_end must not be before term_start")
        return self


class OfficialUpdate(SQLModel):
    """Partial update. Send ``term_end: null`` to clear the end date.

    There is no delete: set ``is_current`` to false instead, because issued
    documents will point at the official.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    position: str | None = Field(default=None, min_length=1, max_length=100)
    term_start: date | None = None
    term_end: date | None = None
    is_elected: bool | None = None
    is_current: bool | None = None

    @field_validator("full_name", "position")
    @classmethod
    def _tidy(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = _clean_name(value)
        if not value:
            raise ValueError("Value must not be empty")
        return value
