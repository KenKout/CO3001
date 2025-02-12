from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (Notification, NotificationType, Penalty, PenaltyType,
                      Reservation, User, UserRole)
from ..models.notifications import NotificationCreate
from ..models.penalties import PenaltyCreate, PenaltyResponse, PenaltyUpdate
from ..utils.error_handler import APIError
from .auth import get_current_user

router = APIRouter()

# Helper functions
def check_admin_access(current_user: User):
    if current_user.role != UserRole.ADMIN:
        APIError.forbidden("Admin access required")

def update_user_penalty_points(db: Session, user_id: int) -> int:
    """Update user's total penalty points"""
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        # Get active penalties
        now = datetime.utcnow()
        active_penalties = db.query(Penalty).filter(
            Penalty.user_id == user_id,
            Penalty.expires_at > now,
            Penalty.is_active == True
        ).all()
        
        # Calculate total points
        total_points = sum(p.points for p in active_penalties)
        user.penalty_points = total_points
        db.commit()
        return total_points
    return 0

def check_user_restrictions(penalty_points: int) -> dict:
    """Check user restrictions based on penalty points"""
    return {
        "has_restrictions": penalty_points >= 5,
        "can_make_reservation": penalty_points < 5,
        "is_suspended": penalty_points >= 8,
        "restriction_level": "suspended" if penalty_points >= 8 else "restricted" if penalty_points >= 5 else "none"
    }

@router.post(
    "/admin/penalties",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {
            "description": "Penalty successfully created",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "penalty": {
                                "id": 1,
                                "type": "NO_SHOW",
                                "points": 2,
                                "expires_at": "2024-03-12T13:00:00"
                            },
                            "user_status": {
                                "total_points": 2,
                                "restrictions": {
                                    "has_restrictions": False,
                                    "can_make_reservation": True,
                                    "is_suspended": False,
                                    "restriction_level": "none"
                                }
                            }
                        }
                    }
                }
            }
        },
        403: {"description": "Not authorized (Admin only)"},
        404: {"description": "User not found"}
    }
)
async def create_penalty(
    penalty: PenaltyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Create a new penalty for a user (Admin only).
    
    - **user_id**: ID of the user to penalize
    - **type**: Type of penalty (e.g., NO_SHOW, LATE_CHECK_IN)
    - **reservation_id**: Optional ID of related reservation
    - **description**: Optional description of the penalty
    """
    check_admin_access(current_user)

    # Verify user exists
    user = db.query(User).filter(User.id == penalty.user_id).first()
    if not user:
        APIError.not_found("User not found")

    # Create penalty
    points = Penalty.get_points_for_type(penalty.type)
    db_penalty = Penalty(
        **penalty.dict(),
        points=points,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    db.add(db_penalty)
    db.commit()
    db.refresh(db_penalty)

    # Update user's penalty points
    total_points = update_user_penalty_points(db, penalty.user_id)
    restrictions = check_user_restrictions(total_points)

    # Create notification
    notification = NotificationCreate(
        user_id=penalty.user_id,
        type=NotificationType.PENALTY_NOTIFICATION,
        message=f"You received a {points}-point penalty for {penalty.type}",
        reference_id=db_penalty.id,
        reference_type="penalty"
    )
    db_notification = Notification(**notification.dict())
    db.add(db_notification)
    db.commit()

    return {
        "success": True,
        "data": {
            "penalty": PenaltyResponse.from_orm(db_penalty),
            "user_status": {
                "total_points": total_points,
                "restrictions": restrictions
            }
        }
    }

@router.get(
    "/users/{user_id}/penalties",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved user penalties",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "penalties": [
                                {
                                    "id": 1,
                                    "type": "NO_SHOW",
                                    "points": 2,
                                    "description": "Missed reservation",
                                    "created_at": "2024-02-12T13:00:00",
                                    "expires_at": "2024-03-12T13:00:00",
                                    "is_active": True
                                }
                            ],
                            "user_status": {
                                "total_points": 2,
                                "restrictions": {
                                    "has_restrictions": False,
                                    "can_make_reservation": True,
                                    "is_suspended": False
                                }
                            }
                        }
                    }
                }
            }
        },
        403: {"description": "Not authorized to view these penalties"}
    }
)
async def get_user_penalties(
    user_id: int,
    include_expired: bool = False,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Get penalties for a specific user.
    
    - **user_id**: ID of the user to get penalties for
    - **include_expired**: Include expired penalties in the response
    - **page**: Page number for pagination (starts at 1)
    - **per_page**: Number of items per page (max 100)
    """
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        APIError.forbidden("Not authorized to view these penalties")

    query = db.query(Penalty).filter(Penalty.user_id == user_id)
    if not include_expired:
        query = query.filter(Penalty.expires_at > datetime.utcnow())
    
    total = query.count()
    penalties = query.order_by(Penalty.created_at.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()

    total_points = update_user_penalty_points(db, user_id)
    restrictions = check_user_restrictions(total_points)

    return {
        "success": True,
        "data": {
            "penalties": [PenaltyResponse.from_orm(p) for p in penalties],
            "user_status": {
                "total_points": total_points,
                "restrictions": restrictions
            },
            "total": total,
            "page": page,
            "per_page": per_page
        }
    }

@router.put(
    "/admin/penalties/{penalty_id}",
    response_model=dict,
    responses={
        200: {
            "description": "Penalty successfully updated",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "penalty": {
                                "id": 1,
                                "type": "NO_SHOW",
                                "points": 2,
                                "description": "Updated description",
                                "is_active": True
                            }
                        }
                    }
                }
            }
        },
        403: {"description": "Not authorized (Admin only)"},
        404: {"description": "Penalty not found"}
    }
)
async def update_penalty(
    penalty_id: int,
    penalty_update: PenaltyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Update a penalty (Admin only).
    
    - **penalty_id**: ID of the penalty to update
    - **is_active**: Optional boolean to activate/deactivate the penalty
    - **description**: Optional updated description
    """
    check_admin_access(current_user)

    penalty = db.query(Penalty).filter(Penalty.id == penalty_id).first()
    if not penalty:
        APIError.not_found("Penalty not found")

    for field, value in penalty_update.dict(exclude_unset=True).items():
        setattr(penalty, field, value)

    db.commit()
    db.refresh(penalty)

    # Update user's penalty points if active status changed
    if penalty_update.is_active is not None:
        update_user_penalty_points(db, penalty.user_id)

    return {
        "success": True,
        "data": {
            "penalty": PenaltyResponse.from_orm(penalty)
        }
    }
