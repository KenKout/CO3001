from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from ..database import get_db
from ..models import (
    User, UserRole, Penalty, PenaltyType, Reservation,
    Notification, NotificationType
)
from .auth import get_current_user

router = APIRouter()

# Pydantic models
class PenaltyCreate(BaseModel):
    user_id: int
    type: PenaltyType
    reservation_id: Optional[int] = None
    description: Optional[str] = None

class PenaltyResponse(BaseModel):
    id: int
    user_id: int
    type: PenaltyType
    points: int
    description: Optional[str]
    created_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True

# Helper functions
def check_admin_access(current_user: User):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

def update_user_penalty_points(db: Session, user_id: int):
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

# Routes
@router.post("/admin/penalties", response_model=dict)
async def create_penalty(
    penalty: PenaltyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify admin access
    check_admin_access(current_user)

    # Verify user exists
    user = db.query(User).filter(User.id == penalty.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Create penalty
    points = Penalty.get_points_for_type(penalty.type)
    db_penalty = Penalty(
        user_id=penalty.user_id,
        type=penalty.type,
        points=points,
        reservation_id=penalty.reservation_id,
        description=penalty.description,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    db.add(db_penalty)
    db.commit()
    db.refresh(db_penalty)

    # Update user's penalty points
    total_points = update_user_penalty_points(db, penalty.user_id)
    restrictions = check_user_restrictions(total_points)

    # Create notification
    notification = Notification(
        user_id=penalty.user_id,
        type=NotificationType.PENALTY_NOTIFICATION,
        message=f"You received a {points}-point penalty for {penalty.type}",
        reference_id=db_penalty.id,
        reference_type="penalty"
    )
    db.add(notification)
    db.commit()

    return {
        "success": True,
        "data": {
            "penalty_id": db_penalty.id,
            "type": db_penalty.type,
            "points": db_penalty.points,
            "expires_at": db_penalty.expires_at,
            "user_status": {
                "total_points": total_points,
                "restrictions": restrictions
            }
        }
    }

@router.get("/users/{user_id}/penalties", response_model=dict)
async def get_user_penalties(
    user_id: int,
    include_expired: bool = False,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Users can view their own penalties, admins can view all
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view these penalties"
        )

    # Get user's penalties
    query = db.query(Penalty).filter(Penalty.user_id == user_id)
    if not include_expired:
        query = query.filter(Penalty.expires_at > datetime.utcnow())
    
    total = query.count()
    penalties = query.order_by(Penalty.created_at.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()

    # Get current restrictions
    total_points = update_user_penalty_points(db, user_id)
    restrictions = check_user_restrictions(total_points)

    return {
        "success": True,
        "data": {
            "user_id": user_id,
            "current_penalty_points": total_points,
            "can_make_reservation": restrictions["can_make_reservation"],
            "restrictions": {
                "has_restrictions": restrictions["has_restrictions"],
                "level": restrictions["restriction_level"],
                "details": "Account suspended" if restrictions["is_suspended"] else 
                          "Booking restricted" if restrictions["has_restrictions"] else None
            },
            "penalty_history": [
                {
                    "penalty_id": p.id,
                    "type": p.type,
                    "points": p.points,
                    "description": p.description,
                    "reservation_id": p.reservation_id,
                    "created_at": p.created_at,
                    "expires_at": p.expires_at,
                    "is_active": p.is_active and p.expires_at > datetime.utcnow()
                }
                for p in penalties
            ],
            "total": total,
            "page": page,
            "per_page": per_page
        }
    }

@router.get("/admin/penalties/stats", response_model=dict)
async def get_penalty_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)

    now = datetime.utcnow()
    
    # Get active penalties
    active_penalties = db.query(Penalty).filter(
        Penalty.expires_at > now,
        Penalty.is_active == True
    ).all()

    # Calculate statistics
    total_active = len(active_penalties)
    by_type = {ptype: 0 for ptype in PenaltyType}
    users_with_restrictions = 0
    users_suspended = 0

    for penalty in active_penalties:
        by_type[penalty.type] += 1
        points = update_user_penalty_points(db, penalty.user_id)
        if points >= 8:
            users_suspended += 1
        elif points >= 5:
            users_with_restrictions += 1

    return {
        "success": True,
        "data": {
            "total_active_penalties": total_active,
            "penalties_by_type": by_type,
            "user_impacts": {
                "users_with_restrictions": users_with_restrictions,
                "users_suspended": users_suspended
            }
        }
    }
