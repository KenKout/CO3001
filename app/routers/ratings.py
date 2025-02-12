from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (Notification, NotificationType, Rating, Reservation,
                      ReservationStatus, User, UserRole)
from ..models.notifications import NotificationCreate
from ..models.ratings import (RatingCreate, RatingResponse, RatingUpdate,
                              RatingWithUserInfo)
from ..utils.error_handler import APIError
from .auth import get_current_user

router = APIRouter()

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

@router.post(
    "/admin/ratings",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {
            "description": "Rating successfully created",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "rating": {
                                "id": 1,
                                "user_id": 2,
                                "reservation_id": 3,
                                "rating": 5,
                                "comment": "Excellent space usage"
                            }
                        }
                    }
                }
            }
        },
        400: {"description": "Invalid rating request"},
        403: {"description": "Not authorized (Admin only)"},
        404: {"description": "Reservation not found"}
    }
)
async def create_rating(
    rating: RatingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Create a rating for a user's reservation (Admin only).
    
    - **reservation_id**: ID of the completed reservation
    - **user_id**: ID of the user to rate
    - **rating**: Rating value (1-5)
    - **comment**: Optional comment about the rating
    """
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
        **rating.dict(),
        rated_by=current_user.id
    )
    db.add(db_rating)
    
    # Mark reservation as rated
    reservation.is_rated = True
    
    db.commit()
    db.refresh(db_rating)

    # Update user's average rating
    update_user_average_rating(db, rating.user_id)

    # Create notification
    notification = NotificationCreate(
        user_id=rating.user_id,
        type=NotificationType.RATING_RECEIVED,
        message=f"You received a {rating.rating}/5 rating for your reservation",
        reference_id=db_rating.id,
        reference_type="rating"
    )
    db_notification = Notification(**notification.dict())
    db.add(db_notification)
    db.commit()

    return {
        "success": True,
        "data": {
            "rating": RatingResponse.from_orm(db_rating)
        }
    }

@router.get(
    "/users/{user_id}/ratings",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved user ratings",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "ratings": [
                                {
                                    "id": 1,
                                    "reservation_id": 3,
                                    "rating": 5,
                                    "comment": "Excellent space usage",
                                    "created_at": "2024-02-12T13:00:00",
                                    "rated_by": {
                                        "id": 1,
                                        "name": "Admin User"
                                    }
                                }
                            ],
                            "total": 1,
                            "average_rating": 4.5
                        }
                    }
                }
            }
        },
        403: {"description": "Not authorized to view these ratings"},
        404: {"description": "User not found"}
    }
)
async def get_user_ratings(
    user_id: int,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Get ratings for a specific user.
    
    - **user_id**: ID of the user to get ratings for
    - **page**: Page number for pagination (starts at 1)
    - **per_page**: Number of items per page (max 100)
    """
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        APIError.forbidden("Not authorized to view these ratings")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        APIError.not_found("User not found")

    query = db.query(Rating).filter(Rating.user_id == user_id)
    total = query.count()
    ratings = query.order_by(Rating.created_at.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()

    return {
        "success": True,
        "data": {
            "ratings": [RatingWithUserInfo.from_orm(r) for r in ratings],
            "total": total,
            "page": page,
            "per_page": per_page,
            "average_rating": user.average_rating
        }
    }

@router.put(
    "/admin/ratings/{rating_id}",
    response_model=dict,
    responses={
        200: {
            "description": "Rating successfully updated",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "rating": {
                                "id": 1,
                                "rating": 4,
                                "comment": "Updated comment"
                            }
                        }
                    }
                }
            }
        },
        403: {"description": "Not authorized (Admin only)"},
        404: {"description": "Rating not found"}
    }
)
async def update_rating(
    rating_id: int,
    rating_update: RatingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Update an existing rating (Admin only).
    
    - **rating_id**: ID of the rating to update
    - **rating**: Updated rating value (1-5)
    - **comment**: Updated comment
    """
    check_admin_access(current_user)

    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        APIError.not_found("Rating not found")

    for field, value in rating_update.dict(exclude_unset=True).items():
        setattr(rating, field, value)

    db.commit()
    db.refresh(rating)

    # Update user's average rating if rating value changed
    if rating_update.rating is not None:
        update_user_average_rating(db, rating.user_id)

    return {
        "success": True,
        "data": {
            "rating": RatingResponse.from_orm(rating)
        }
    }
