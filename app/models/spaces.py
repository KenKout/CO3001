import enum
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel
from sqlalchemy import (JSON, Boolean, Column, DateTime, Enum, Float, Integer,
                        String)
from sqlalchemy.sql import func

from ..database import Base


class SpaceType(str, enum.Enum):
    INDIVIDUAL = "individual"
    GROUP = "group"
    MEETING = "meeting"
    QUIET = "quiet"

class SpaceStatus(str, enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"
    RESERVED = "reserved"

class Space(Base):
    __tablename__ = "spaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    capacity = Column(Integer, nullable=False)
    type = Column(Enum(SpaceType), nullable=False)
    status = Column(Enum(SpaceStatus), default=SpaceStatus.AVAILABLE)
    equipment = Column(JSON, default=list)  # List of available equipment
    location = Column(String, nullable=False)
    description = Column(String, nullable=True)
    average_rating = Column(Float, default=0.0)
    total_ratings = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_modified = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Space {self.name}>"

    @property
    def equipment_list(self) -> list:
        """Returns the equipment as a Python list"""
        return self.equipment if self.equipment else []

# Pydantic models for request/response validation
class EquipmentList(BaseModel):
    equipment: List[str]

class SpaceBase(BaseModel):
    name: str
    capacity: int
    type: SpaceType
    location: str
    description: Optional[str] = None
    equipment: List[str] = []

class SpaceCreate(SpaceBase):
    pass

class SpaceUpdate(SpaceBase):
    name: Optional[str] = None
    capacity: Optional[int] = None
    type: Optional[SpaceType] = None
    location: Optional[str] = None
    status: Optional[SpaceStatus] = None
    is_active: Optional[bool] = None

class SpaceResponse(SpaceBase):
    id: int
    status: SpaceStatus
    average_rating: float
    total_ratings: int
    is_active: bool
    created_at: datetime
    last_modified: Optional[datetime]

    class Config:
        from_attributes = True

class TimeSlot(BaseModel):
    start: datetime
    end: datetime

class SpaceAvailability(BaseModel):
    next_available: Optional[datetime]
    today_slots: List[TimeSlot]

    class Config:
        from_attributes = True
