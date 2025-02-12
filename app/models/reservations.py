import enum

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
