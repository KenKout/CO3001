import enum
from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import (Boolean, Column, DateTime, Enum, ForeignKey, Integer,
                        String)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class NotificationType(str, enum.Enum):
    RESERVATION_CONFIRMATION = "reservation_confirmation"
    CHECK_IN_REMINDER = "check_in_reminder"
    PENALTY_NOTIFICATION = "penalty_notification"
    RATING_RECEIVED = "rating_received"
    RESERVATION_CANCELLED = "reservation_cancelled"
    SYSTEM_NOTIFICATION = "system_notification"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    message = Column(String, nullable=False)
    reference_id = Column(Integer, nullable=True)  # ID of related entity (reservation, rating, etc.)
    reference_type = Column(String, nullable=True)  # Type of related entity
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)
    is_read = Column(Boolean, default=False)
    is_email_sent = Column(Boolean, default=False)

    # Relationships
    user = relationship("User", backref="notifications")

    def __repr__(self):
        return f"<Notification {self.id} - {self.type}>"

    def mark_as_read(self):
        """Mark the notification as read"""
        self.is_read = True
        self.read_at = func.now()

    @property
    def short_message(self) -> str:
        """Return a shortened version of the message for previews"""
        max_length = 50
        return (self.message[:max_length] + '...') if len(self.message) > max_length else self.message

# Pydantic models for request/response validation
class NotificationBase(BaseModel):
    type: NotificationType
    message: str
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None

class NotificationCreate(NotificationBase):
    user_id: int

class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None
    is_email_sent: Optional[bool] = None

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    created_at: datetime
    read_at: Optional[datetime]
    is_read: bool
    is_email_sent: bool

    class Config:
        from_attributes = True
