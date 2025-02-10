from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base
import enum
from datetime import datetime, timedelta

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
