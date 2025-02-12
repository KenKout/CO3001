import enum
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, validator
from sqlalchemy import (Boolean, Column, DateTime, Enum, ForeignKey, Integer,
                        String)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class ReservationStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    space_id = Column(Integer, ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(ReservationStatus), default=ReservationStatus.PENDING)
    check_in_time = Column(DateTime(timezone=True), nullable=True)
    check_out_time = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    qr_code = Column(String, nullable=True)  # Store QR code data or path
    notes = Column(String, nullable=True)
    is_rated = Column(Boolean, default=False)

    # Relationships
    user = relationship("User", backref="reservations")
    space = relationship("Space", backref="reservations")

    def __repr__(self):
        return f"<Reservation {self.id} - {self.status}>"

    @property
    def is_active(self) -> bool:
        """Check if the reservation is currently active"""
        return self.status in [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN]

    @property
    def can_check_in(self) -> bool:
        """Check if the reservation can be checked in"""
        now = func.now()
        return (self.status == ReservationStatus.CONFIRMED and 
                self.start_time <= now <= self.end_time)

# Pydantic models for request/response validation
class ReservationBase(BaseModel):
    space_id: int
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None

    @validator('end_time')
    def end_time_must_be_after_start_time(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('end_time must be after start_time')
        return v

    @validator('start_time')
    def start_time_must_be_future(cls, v):
        if v <= datetime.utcnow():
            raise ValueError('start_time must be in the future')
        return v

class ReservationCreate(ReservationBase):
    pass

class ReservationUpdate(BaseModel):
    notes: Optional[str] = None
    status: Optional[ReservationStatus] = None

class SpaceInfo(BaseModel):
    id: int
    name: str
    location: str

    class Config:
        from_attributes = True

class UserInfo(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True

class ReservationResponse(ReservationBase):
    id: int
    user_id: int
    status: ReservationStatus
    check_in_time: Optional[datetime]
    check_out_time: Optional[datetime]
    created_at: datetime
    qr_code: Optional[str]
    is_rated: bool
    space: SpaceInfo

    class Config:
        from_attributes = True

class ReservationDetailResponse(ReservationResponse):
    user: UserInfo
    penalties: List[dict] = []  # List of associated penalties
    rating: Optional[dict] = None  # Rating information if rated

    class Config:
        from_attributes = True
