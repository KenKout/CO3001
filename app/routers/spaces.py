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
    today_start = datetime(now.year, now.month, now.day, 9, 0, 0)  # 9 AM
    today_end = datetime(now.year, now.month, now.day, 16, 0, 0)   # 4 PM
    
    # If current time is after end time (4 PM), no slots available
    if now >= today_end:
        return SpaceAvailability(
            next_available=None,
            today_slots=[]
        )
    
    # Get today's reservations
    reservations = db.query(Reservation).filter(
        Reservation.space_id == space.id,
        Reservation.start_time >= today_start,
        Reservation.end_time <= today_end,
        Reservation.status.in_(["confirmed", "checked_in"])
    ).order_by(Reservation.start_time).all()

    # Find next available slot
    next_available = max(now, today_start)
    
    # Round up to the next hour
    if next_available.minute > 0 or next_available.second > 0:
        next_available = (next_available + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    
    if reservations:
        for res in reservations:
            if (next_available + timedelta(hours=1)) < res.start_time:
                break
            next_available = res.end_time
            # Round up to the next hour after reservation
            if next_available.minute > 0 or next_available.second > 0:
                next_available = (next_available + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)

    # Get available slots
    slots = []
    current_time = today_start
    while current_time < today_end:
        slot_end = current_time + timedelta(hours=1)
        is_available = True
        
        # Skip slots that start before or at current time
        if current_time <= now:
            current_time = slot_end
            continue
            
        for res in reservations:
            if (current_time < res.end_time and slot_end > res.start_time):
                is_available = False
                break
        if is_available:
            slots.append({
                "start": current_time,
                "end": slot_end
            })
        current_time += timedelta(hours=1)

    return SpaceAvailability(
        next_available=next_available,
        today_slots=slots
    )

# Routes
@router.get(
    "/",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved list of spaces",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "spaces": [
                                {
                                    "id": 1,
                                    "name": "Study Room A",
                                    "capacity": 4,
                                    "type": "individual",
                                    "status": "AVAILABLE",
                                    "equipment": ["whiteboard", "projector"],
                                    "location": "Building A, Floor 2",
                                    "current_occupancy": 0,
                                    "rating": {
                                        "average": 4.5,
                                        "total_ratings": 10
                                    },
                                    "availability": {
                                        "next_available": "2024-02-12T14:00:00",
                                        "today_slots": [
                                            {
                                                "start": "2024-02-12T14:00:00",
                                                "end": "2024-02-12T16:00:00"
                                            }
                                        ]
                                    }
                                }
                            ],
                            "total": 1,
                            "page": 1,
                            "per_page": 10
                        }
                    }
                }
            }
        },
        401: {
            "description": "Not authenticated",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "UNAUTHORIZED",
                            "message": "Not authenticated"
                        }
                    }
                }
            }
        }
    }
)
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
    """
    List all available spaces with optional filtering.
    
    - **type**: Filter by space type (e.g., individual, group, meeting, quiet)
    - **capacity**: Filter by minimum capacity
    - **equipment**: Filter by specific equipment
    - **status**: Filter by space status
    - **page**: Page number for pagination (starts at 1)
    - **per_page**: Number of items per page (max 100)
    """
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

@router.post(
    "/",
    response_model=SpaceResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {
            "description": "Space successfully created",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "name": "Study Room A",
                        "capacity": 4,
                        "type": "individual",
                        "location": "Building A, Floor 2",
                        "description": "Quiet study room with whiteboard",
                        "equipment": ["whiteboard", "projector"],
                        "status": "AVAILABLE",
                        "average_rating": 0,
                        "total_ratings": 0,
                        "is_active": True,
                        "created_at": "2024-02-12T13:00:00"
                    }
                }
            }
        },
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def create_space(
    space: SpaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new space (Admin only).
    
    - **name**: Name of the space
    - **capacity**: Maximum capacity
    - **type**: Type of space (e.g., individual, group, meeting, quiet)
    - **location**: Physical location of the space
    - **description**: Optional description
    - **equipment**: List of available equipment
    """
    check_admin_access(current_user)
    
    db_space = Space(**space.dict())
    db.add(db_space)
    db.commit()
    db.refresh(db_space)
    return db_space

@router.get(
    "/{space_id}",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved space details",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "id": 1,
                            "name": "Study Room A",
                            "capacity": 4,
                            "type": "individual",
                            "status": "AVAILABLE",
                            "equipment": ["whiteboard", "projector"],
                            "location": "Building A, Floor 2",
                            "description": "Quiet study room with whiteboard",
                            "rating": {
                                "average": 4.5,
                                "total_ratings": 10
                            },
                            "availability": {
                                "next_available": "2024-02-12T14:00:00",
                                "today_slots": []
                            },
                            "current_occupancy": 0
                        }
                    }
                }
            }
        },
        404: {"description": "Space not found"}
    }
)
async def get_space(
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information about a specific space.
    
    - **space_id**: ID of the space to retrieve
    """
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

@router.put(
    "/{space_id}",
    response_model=SpaceResponse,
    responses={
        200: {
            "description": "Space successfully updated",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "name": "Study Room A (Updated)",
                        "capacity": 6,
                        "type": "individual",
                        "location": "Building A, Floor 2",
                        "description": "Updated description",
                        "equipment": ["whiteboard", "projector", "computer"],
                        "status": "AVAILABLE",
                        "average_rating": 4.5,
                        "total_ratings": 10,
                        "is_active": True,
                        "created_at": "2024-02-12T13:00:00"
                    }
                }
            }
        },
        404: {"description": "Space not found"},
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def update_space(
    space_id: int,
    space_update: SpaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing space (Admin only).
    
    - **space_id**: ID of the space to update
    - **space_update**: Updated space information
    """
    check_admin_access(current_user)
    
    db_space = db.query(Space).filter(Space.id == space_id).first()
    if not db_space:
        APIError.not_found("Space not found")

    for field, value in space_update.dict(exclude_unset=True).items():
        setattr(db_space, field, value)

    db.commit()
    db.refresh(db_space)
    return db_space

@router.delete(
    "/{space_id}",
    responses={
        200: {
            "description": "Space successfully deleted",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Space deleted successfully"
                    }
                }
            }
        },
        404: {"description": "Space not found"},
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def delete_space(
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Soft delete a space (Admin only).
    
    - **space_id**: ID of the space to delete
    """
    check_admin_access(current_user)
    
    db_space = db.query(Space).filter(Space.id == space_id).first()
    if not db_space:
        APIError.not_found("Space not found")

    # Soft delete
    db_space.is_active = False
    db.commit()

    return {"success": True, "message": "Space deleted successfully"}
