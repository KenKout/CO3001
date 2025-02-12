from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, conint
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (Notification, NotificationType, Rating, Reservation,
                      ReservationStatus, User, UserRole)
from ..utils.error_handler import APIError
from .auth import get_current_user

router = APIRouter()

# Pydantic models
class RatingCreate(BaseModel):
    reservation_id: int
    user_id: int
    rating: conint(ge=1, le=5)  # Rating must be between 1 and 5
    comment: Optional[str] = None

class RatingResponse(BaseModel):
    id: int
    user_id: int
    reservation_id: int
    rating: int
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Helper functions
def check_admin_access(current_user: User):
    if current_user.role != UserRole.ADMIN:
        APIError.forbidden("Admin access required")

def update_user_average_rating(db: Session, user_id: int):
    """Update user's average rating"""
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        ratings = db.query(Rating).filter(Rating.user_id == user_id).all()
        if ratings:
            total_rating = sum(r.rating for r in ratings)
            user.average_rating = total_rating / len(ratings)
            db.commit()

# Routes
@router.post("/admin/ratings", response_model=dict)
async def create_rating(
    rating: RatingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify admin access
    check_admin_access(current_user)

    # Verify reservation exists and is completed
    reservation = db.query(Reservation).filter(Reservation.id == rating.reservation_id).first()
    if not reservation:
        APIError.not_found("Reservation not found")

    if reservation.status != ReservationStatus.COMPLETED:
        APIError.bad_request("Can only rate completed reservations")

    if reservation.is_rated:
        APIError.bad_request("Reservation has already been rated")

    # Create rating
    db_rating = Rating(
        user_id=rating.user_id,
        reservation_id=rating.reservation_id,
        rated_by=current_user.id,
        rating=rating.rating,
        comment=rating.comment
    )
    db.add(db_rating)
    
    # Mark reservation as rated
    reservation.is_rated = True
    
    db.commit()
    db.refresh(db_rating)

    # Update user's average rating
    update_user_average_rating(db, rating.user_id)

    # Create notification
    notification = Notification(
        user_id=rating.user_id,
        type=NotificationType.RATING_RECEIVED,
        message=f"You received a {rating.rating}/5 rating for your reservation",
        reference_id=db_rating.id,
        reference_type="rating"
    )
    db.add(notification)
    db.commit()

    return {
        "success": True,
        "data": {
            "rating_id": db_rating.id,
            "user_id": db_rating.user_id,
            "reservation_id": db_rating.reservation_id,
            "rating": db_rating.rating,
            "comment": db_rating.comment,
            "created_at": db_rating.created_at
        }
    }

@router.get("/users/{user_id}/ratings", response_model=dict)
async def get_user_ratings(
    user_id: int,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Users can view their own ratings, admins can view all
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        APIError.forbidden("Not authorized to view these ratings")

    # Get user's ratings
    query = db.query(Rating).filter(Rating.user_id == user_id)
    total = query.count()
    ratings = query.order_by(Rating.created_at.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()

    return {
        "success": True,
        "data": {
            "ratings": [
                {
                    "id": r.id,
                    "reservation_id": r.reservation_id,
                    "rating": r.rating,
                    "comment": r.comment,
                    "created_at": r.created_at,
                    "rated_by": {
                        "id": r.rater.id,
                        "name": r.rater.name
                    } if r.rater else None
                }
                for r in ratings
            ],
            "total": total,
            "page": page,
            "per_page": per_page,
            "average_rating": current_user.average_rating
        }
    }

@router.get("/admin/ratings/stats", response_model=dict)
async def get_rating_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)

    # Get overall statistics
    all_ratings = db.query(Rating).all()
    total_ratings = len(all_ratings)
    
    if total_ratings == 0:
        return {
            "success": True,
            "data": {
                "total_ratings": 0,
                "average_rating": 0,
                "distribution": {str(i): 0 for i in range(1, 6)}
            }
        }

    # Calculate distribution
    distribution = {str(i): 0 for i in range(1, 6)}
    total_score = 0

    for r in all_ratings:
        distribution[str(r.rating)] += 1
        total_score += r.rating

    return {
        "success": True,
        "data": {
            "total_ratings": total_ratings,
            "average_rating": round(total_score / total_ratings, 2),
            "distribution": distribution
        }
    }
