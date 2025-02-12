from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Reservation, Space, SpaceStatus, SpaceType
from ..models.users import User, UserRole
from ..utils.error_handler import APIError
from .auth import get_current_user

router = APIRouter()

# Pydantic models
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
    status: Optional[SpaceStatus] = None
    is_active: Optional[bool] = None

class SpaceResponse(SpaceBase):
    id: int
    status: SpaceStatus
    average_rating: float
    total_ratings: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class SpaceAvailability(BaseModel):
    next_available: Optional[datetime]
    today_slots: List[dict]

# Helper functions
def check_admin_access(current_user: User):
    if current_user.role != UserRole.ADMIN:
        APIError.forbidden("Admin access required")

def get_space_availability(space: Space, db: Session) -> SpaceAvailability:
    now = datetime.utcnow()
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59)
    
    # Get today's reservations
    reservations = db.query(Reservation).filter(
        Reservation.space_id == space.id,
        Reservation.start_time >= now,
        Reservation.end_time <= today_end,
        Reservation.status.in_(["confirmed", "checked_in"])
    ).order_by(Reservation.start_time).all()

    # Find next available slot
    next_available = now
    if reservations:
        for res in reservations:
            if (next_available + timedelta(minutes=30)) < res.start_time:
                break
            next_available = res.end_time

    # Get available slots
    slots = []
    current_time = now
    while current_time < today_end:
        slot_end = current_time + timedelta(hours=2)
        is_available = True
        for res in reservations:
            if (current_time < res.end_time and slot_end > res.start_time):
                is_available = False
                break
        if is_available:
            slots.append({
                "start": current_time,
                "end": slot_end
            })
        current_time += timedelta(minutes=30)

    return SpaceAvailability(
        next_available=next_available,
        today_slots=slots
    )

# Routes
@router.get("/", response_model=dict)
async def list_spaces(
    type: Optional[SpaceType] = None,
    capacity: Optional[int] = None,
    equipment: Optional[str] = None,
    status: Optional[SpaceStatus] = None,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Space).filter(Space.is_active == True)
    
    # Apply filters
    if type:
        query = query.filter(Space.type == type)
    if capacity:
        query = query.filter(Space.capacity >= capacity)
    if equipment:
        query = query.filter(Space.equipment.contains([equipment]))
    if status:
        query = query.filter(Space.status == status)

    # Pagination
    total = query.count()
    spaces = query.offset((page - 1) * per_page).limit(per_page).all()

    # Get availability for each space
    space_data = []
    for space in spaces:
        availability = get_space_availability(space, db)
        space_dict = {
            "id": space.id,
            "name": space.name,
            "capacity": space.capacity,
            "type": space.type,
            "status": space.status,
            "equipment": space.equipment_list,
            "location": space.location,
            "current_occupancy": len([r for r in space.reservations if r.status == "checked_in"]),
            "rating": {
                "average": space.average_rating,
                "total_ratings": space.total_ratings
            },
            "availability": availability
        }
        space_data.append(space_dict)

    return {
        "success": True,
        "data": {
            "spaces": space_data,
            "total": total,
            "page": page,
            "per_page": per_page
        }
    }

@router.post("/", response_model=SpaceResponse)
async def create_space(
    space: SpaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    db_space = Space(**space.dict())
    db.add(db_space)
    db.commit()
    db.refresh(db_space)
    return db_space

@router.get("/{space_id}", response_model=dict)
async def get_space(
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        APIError.not_found("Space not found")

    availability = get_space_availability(space, db)
    
    return {
        "success": True,
        "data": {
            "id": space.id,
            "name": space.name,
            "capacity": space.capacity,
            "type": space.type,
            "status": space.status,
            "equipment": space.equipment_list,
            "location": space.location,
            "description": space.description,
            "rating": {
                "average": space.average_rating,
                "total_ratings": space.total_ratings
            },
            "availability": availability,
            "current_occupancy": len([r for r in space.reservations if r.status == "checked_in"])
        }
    }

@router.put("/{space_id}", response_model=SpaceResponse)
async def update_space(
    space_id: int,
    space_update: SpaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    db_space = db.query(Space).filter(Space.id == space_id).first()
    if not db_space:
        APIError.not_found("Space not found")

    for field, value in space_update.dict(exclude_unset=True).items():
        setattr(db_space, field, value)

    db.commit()
    db.refresh(db_space)
    return db_space

@router.delete("/{space_id}")
async def delete_space(
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    db_space = db.query(Space).filter(Space.id == space_id).first()
    if not db_space:
        APIError.not_found("Space not found")

    # Soft delete
    db_space.is_active = False
    db.commit()

    return {"success": True, "message": "Space deleted successfully"}
