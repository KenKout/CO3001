import enum
from datetime import datetime, timedelta
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import (Boolean, Column, DateTime, Enum, ForeignKey, Integer,
                        String)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class PenaltyType(str, enum.Enum):
    NO_SHOW = "no_show"
    LATE_ARRIVAL = "late_arrival"
    DAMAGE = "damage"
    NOISE = "noise"
    UNAUTHORIZED = "unauthorized"

def default_expiry():
    """Default expiry is 30 days from now"""
    return datetime.utcnow() + timedelta(days=30)

class Penalty(Base):
    __tablename__ = "penalties"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reservation_id = Column(Integer, ForeignKey("reservations.id", ondelete="SET NULL"), nullable=True)
    type = Column(Enum(PenaltyType), nullable=False)
    points = Column(Integer, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), default=default_expiry)
    is_active = Column(Boolean, default=True)

    # Relationships
    user = relationship("User", backref="penalties")
    reservation = relationship("Reservation", backref="penalties")

    def __repr__(self):
        return f"<Penalty {self.id} - {self.type}: {self.points} points>"

    @property
    def is_expired(self) -> bool:
        """Check if the penalty has expired"""
        return datetime.utcnow() > self.expires_at

    @classmethod
    def get_points_for_type(cls, penalty_type: PenaltyType) -> int:
        """Get the standard points for a penalty type"""
        points_map = {
            PenaltyType.NO_SHOW: 2,
            PenaltyType.LATE_ARRIVAL: 1,
            PenaltyType.DAMAGE: 3,
            PenaltyType.NOISE: 1,
            PenaltyType.UNAUTHORIZED: 2
        }
        return points_map.get(penalty_type, 1)

# Pydantic models for request/response validation
class PenaltyBase(BaseModel):
    type: PenaltyType
    description: Optional[str] = None
    reservation_id: Optional[int] = None

class PenaltyCreate(PenaltyBase):
    user_id: int

class PenaltyUpdate(BaseModel):
    is_active: Optional[bool] = None
    description: Optional[str] = None

class PenaltyResponse(BaseModel):
    id: int
    user_id: int
    type: PenaltyType
    points: int
    description: Optional[str]
    created_at: datetime
    expires_at: datetime
    is_active: bool
    reservation_id: Optional[int]

    class Config:
        from_attributes = True
