from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Reservation, Space, SpaceStatus, SpaceType
from ..models.spaces import (SpaceAvailability, SpaceBase, SpaceCreate,
                             SpaceResponse, SpaceUpdate, TimeSlot)
from ..models.users import User, UserRole
from ..utils.error_handler import APIError
from .auth import get_current_user

router = APIRouter()

def check_admin_access(current_user: User):
    if current_user.role != UserRole.ADMIN:
        APIError.forbidden("Admin access required")

def get_space_availability(space: Space, db: Session) -> SpaceAvailability:
    """Get space availability for today"""
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
            slots.append(TimeSlot(
                start=current_time,
                end=slot_end
            ))
        current_time += timedelta(hours=1)

    return SpaceAvailability(
        next_available=next_available,
        today_slots=slots
    )

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
                                    "availability": {
                                        "next_available": "2024-02-12T14:00:00",
                                        "today_slots": []
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
) -> dict:
    """
    List all available spaces with optional filtering.
    
    - **type**: Filter by space type
    - **capacity**: Filter by minimum capacity
    - **equipment**: Filter by specific equipment
    - **status**: Filter by space status
    - **page**: Page number for pagination
    - **per_page**: Items per page
    """
    query = db.query(Space).filter(Space.is_active == True)
    
    if type:
        query = query.filter(Space.type == type)
    if capacity:
        query = query.filter(Space.capacity >= capacity)
    if equipment:
        query = query.filter(Space.equipment.contains([equipment]))
    if status:
        query = query.filter(Space.status == status)

    total = query.count()
    spaces = query.offset((page - 1) * per_page).limit(per_page).all()

    space_data = []
    for space in spaces:
        space_response = SpaceResponse.from_orm(space)
        availability = get_space_availability(space, db)
        space_data.append({
            **space_response.dict(),
            "availability": availability
        })

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
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {
            "description": "Space successfully created",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "space": {
                                "id": 1,
                                "name": "Study Room A",
                                "capacity": 4,
                                "type": "individual",
                                "location": "Building A"
                            }
                        }
                    }
                }
            }
        },
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def create_space(
    space: SpaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Create a new space (Admin only).
    
    - **name**: Name of the space
    - **capacity**: Maximum capacity
    - **type**: Type of space
    - **location**: Physical location
    - **description**: Optional description
    - **equipment**: List of available equipment
    """
    check_admin_access(current_user)
    
    db_space = Space(**space.dict())
    db.add(db_space)
    db.commit()
    db.refresh(db_space)
    
    return {
        "success": True,
        "data": {
            "space": SpaceResponse.from_orm(db_space)
        }
    }

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
                            "space": {
                                "id": 1,
                                "name": "Study Room A",
                                "capacity": 4,
                                "type": "individual",
                                "status": "AVAILABLE",
                                "equipment": ["whiteboard", "projector"],
                                "location": "Building A"
                            }
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
) -> dict:
    """
    Get detailed information about a specific space.
    
    - **space_id**: ID of the space to retrieve
    """
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        APIError.not_found("Space not found")

    space_response = SpaceResponse.from_orm(space)
    availability = get_space_availability(space, db)
    
    return {
        "success": True,
        "data": {
            "space": {
                **space_response.dict(),
                "availability": availability
            }
        }
    }

@router.put(
    "/{space_id}",
    response_model=dict,
    responses={
        200: {
            "description": "Space successfully updated",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "space": {
                                "id": 1,
                                "name": "Study Room A (Updated)",
                                "capacity": 6,
                                "type": "individual",
                                "location": "Building A"
                            }
                        }
                    }
                }
            }
        },
        403: {"description": "Not authorized (Admin only)"},
        404: {"description": "Space not found"}
    }
)
async def update_space(
    space_id: int,
    space_update: SpaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Update an existing space (Admin only).
    
    - **space_id**: ID of the space to update
    - **space_update**: Updated space information
    """
    check_admin_access(current_user)
    
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        APIError.not_found("Space not found")

    for field, value in space_update.dict(exclude_unset=True).items():
        setattr(space, field, value)

    db.commit()
    db.refresh(space)
    
    return {
        "success": True,
        "data": {
            "space": SpaceResponse.from_orm(space)
        }
    }

@router.delete(
    "/{space_id}",
    response_model=dict,
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
        403: {"description": "Not authorized (Admin only)"},
        404: {"description": "Space not found"}
    }
)
async def delete_space(
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Soft delete a space (Admin only).
    
    - **space_id**: ID of the space to delete
    """
    check_admin_access(current_user)
    
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        APIError.not_found("Space not found")

    # Soft delete
    space.is_active = False
    db.commit()

    return {
        "success": True,
        "message": "Space deleted successfully"
    }
