from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (Notification, Penalty, Rating, Reservation, ReservationStatus, Space,
                      SpaceStatus, User, UserRole)
from ..utils.error_handler import APIError
from .auth import get_current_user, pwd_context
from ..models.users import UserCreate

router = APIRouter()

# Helper functions
def check_admin_access(current_user: User):
    if current_user.role != UserRole.ADMIN:
        APIError.forbidden("Admin access required")

def get_date_range(days: int = 7):
    """Get date range for statistics"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    return start_date, end_date

# Routes
@router.get(
    "/dashboard",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved dashboard data",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "overview": {
                                "total_spaces": 20,
                                "occupied_spaces": 5,
                                "total_reservations_today": 15,
                                "active_users": 50
                            },
                            "penalty_statistics": {
                                "total_active_penalties": 10,
                                "penalties_by_type": {
                                    "NO_SHOW": 5,
                                    "LATE_CHECK_IN": 3,
                                    "EARLY_CHECK_OUT": 2
                                },
                                "users_with_restrictions": 2
                            },
                            "rating_statistics": {
                                "average_rating": 4.5,
                                "total_ratings": 100,
                                "rating_distribution": {
                                    "1": 2,
                                    "2": 3,
                                    "3": 10,
                                    "4": 35,
                                    "5": 50
                                }
                            },
                            "usage_statistics": {
                                "daily": [
                                    {
                                        "date": "2024-02-12",
                                        "reservations": 25,
                                        "occupancy_rate": 62.5
                                    }
                                ],
                                "popular_spaces": [
                                    {
                                        "space_id": 1,
                                        "name": "Study Room A",
                                        "usage_count": 50,
                                        "average_rating": 4.8
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        },
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def get_dashboard_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive dashboard data for administrators.
    
    Returns:
    - Overview statistics (spaces, reservations, users)
    - Penalty statistics
    - Rating statistics
    - Usage statistics (daily trends and popular spaces)
    """
    check_admin_access(current_user)
    
    now = datetime.utcnow()
    start_date, end_date = get_date_range(7)

    # Space statistics
    total_spaces = db.query(Space).filter(Space.is_active == True).count()
    occupied_spaces = db.query(Space).join(Reservation).filter(
        Space.is_active == True,
        Reservation.status == ReservationStatus.CHECKED_IN
    ).distinct().count()

    # Today's reservations
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)
    total_reservations_today = db.query(Reservation).filter(
        Reservation.start_time >= today_start,
        Reservation.start_time < today_end
    ).count()

    # Active users (users with activity in last 7 days)
    active_users = db.query(User).join(Reservation).filter(
        Reservation.created_at >= start_date
    ).distinct().count()

    # Penalty statistics
    active_penalties = db.query(Penalty).filter(
        Penalty.expires_at > now,
        Penalty.is_active == True
    ).all()
    
    penalties_by_type = {}
    for penalty in active_penalties:
        penalties_by_type[penalty.type] = penalties_by_type.get(penalty.type, 0) + 1

    restricted_users = db.query(User).filter(User.penalty_points >= 5).count()

    # Rating statistics
    rating_stats = db.query(
        func.avg(Rating.rating).label('average'),
        func.count(Rating.id).label('total')
    ).first()

    rating_distribution = db.query(
        Rating.rating,
        func.count(Rating.id)
    ).group_by(Rating.rating).all()

    distribution = {str(i): 0 for i in range(1, 6)}
    for rating, count in rating_distribution:
        distribution[str(rating)] = count

    # Usage statistics for last 7 days
    daily_stats = []
    for i in range(7):
        day_start = end_date - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        reservations = db.query(Reservation).filter(
            Reservation.start_time >= day_start,
            Reservation.start_time < day_end
        ).count()
        
        total_slots = total_spaces * 24  # Assuming 24 possible hours per space
        occupancy_rate = (reservations / total_slots * 100) if total_slots > 0 else 0
        
        daily_stats.append({
            "date": day_start.date().isoformat(),
            "reservations": reservations,
            "occupancy_rate": round(occupancy_rate, 2)
        })

    # Popular spaces
    popular_spaces = db.query(
        Space,
        func.count(Reservation.id).label('usage_count'),
        func.avg(Space.average_rating).label('avg_rating')
    ).join(Reservation).filter(
        Reservation.created_at >= start_date
    ).group_by(Space.id).order_by(
        func.count(Reservation.id).desc()
    ).limit(5).all()

    return {
        "success": True,
        "data": {
            "overview": {
                "total_spaces": total_spaces,
                "occupied_spaces": occupied_spaces,
                "total_reservations_today": total_reservations_today,
                "active_users": active_users
            },
            "penalty_statistics": {
                "total_active_penalties": len(active_penalties),
                "penalties_by_type": penalties_by_type,
                "users_with_restrictions": restricted_users
            },
            "rating_statistics": {
                "average_rating": round(rating_stats[0] or 0, 2),
                "total_ratings": rating_stats[1] or 0,
                "rating_distribution": distribution
            },
            "usage_statistics": {
                "daily": daily_stats,
                "popular_spaces": [
                    {
                        "space_id": space.id,
                        "name": space.name,
                        "usage_count": usage_count,
                        "average_rating": round(avg_rating or 0, 2)
                    }
                    for space, usage_count, avg_rating in popular_spaces
                ]
            }
        }
    }

@router.get(
    "/users",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved user list",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "users": [
                                {
                                    "id": 1,
                                    "email": "user@example.com",
                                    "name": "John Doe",
                                    "role": "USER",
                                    "penalty_points": 0,
                                    "average_rating": 4.5,
                                    "created_at": "2024-02-12T13:00:00",
                                    "last_login": "2024-02-12T13:00:00",
                                    "is_active": True
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
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def list_users(
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    has_penalties: Optional[bool] = None,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List and filter users (Admin only).
    
    - **search**: Search by name or email
    - **role**: Filter by user role
    - **has_penalties**: Filter users with/without penalties
    - **page**: Page number for pagination (starts at 1)
    - **per_page**: Number of items per page (max 100)
    """
    check_admin_access(current_user)

    query = db.query(User)

    # Apply filters
    if search:
        query = query.filter(
User.email.ilike(f"%{search}%")
        )
    if role:
        query = query.filter(User.role == role)
    if has_penalties is not None:
        query = query.filter(User.penalty_points > 0 if has_penalties else User.penalty_points == 0)

    total = query.count()
    users = query.order_by(User.created_at.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()

    return {
        "success": True,
        "data": {
            "users": [
                {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "role": user.role,
                    "penalty_points": user.penalty_points,
                    "average_rating": user.average_rating,
                    "created_at": user.created_at,
                    "last_login": user.last_login,
                    "is_active": user.is_active
                }
                for user in users
            ],
            "total": total,
            "page": page,
            "per_page": per_page
        }
    }

@router.get(
    "/users/{user_id}",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved user details",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "user": {
                                "id": 1,
                                "email": "user@example.com",
                                "name": "John Doe",
                                "role": "STUDENT",
                                "penalty_points": 0,
                                "average_rating": 4.5,
                                "created_at": "2024-02-12T13:00:00",
                                "last_login": "2024-02-12T13:00:00",
                                "is_active": True,
                                "profile_picture": None
                            },
                            "statistics": {
                                "total_reservations": 50,
                                "completed_reservations": 45,
                                "cancelled_reservations": 3,
                                "no_show_reservations": 2,
                                "completion_rate": 90.0,
                                "total_penalties": 2,
                                "active_penalties": 1,
                                "total_ratings": 45,
                                "has_restrictions": False
                            },
                            "reservations": {
                                "recent": [
                                    {
                                        "id": 1,
                                        "space": {
                                            "id": 1,
                                            "name": "Study Room A",
                                            "location": "Building A"
                                        },
                                        "start_time": "2024-02-12T13:00:00",
                                        "end_time": "2024-02-12T15:00:00",
                                        "status": "COMPLETED",
                                        "check_in_time": "2024-02-12T13:05:00",
                                        "check_out_time": "2024-02-12T14:55:00",
                                        "rating": {
                                            "rating": 5,
                                            "comment": "Great space usage"
                                        }
                                    }
                                ],
                                "total": 50,
                                "page": 1,
                                "per_page": 10
                            },
                            "penalties": {
                                "active": [
                                    {
                                        "id": 1,
                                        "type": "NO_SHOW",
                                        "points": 2,
                                        "description": "Missed reservation",
                                        "created_at": "2024-02-12T13:00:00",
                                        "expires_at": "2024-03-12T13:00:00"
                                    }
                                ],
                                "expired": [
                                    {
                                        "id": 2,
                                        "type": "LATE_ARRIVAL",
                                        "points": 1,
                                        "description": "Late check-in",
                                        "created_at": "2024-01-12T13:00:00",
                                        "expires_at": "2024-02-12T13:00:00"
                                    }
                                ]
                            },
                            "ratings": {
                                "received": [
                                    {
                                        "id": 1,
                                        "rating": 5,
                                        "comment": "Excellent space usage",
                                        "created_at": "2024-02-12T15:00:00",
                                        "reservation_id": 1
                                    }
                                ],
                                "total": 45,
                                "page": 1,
                                "per_page": 10
                            },
                            "notifications": {
                                "recent": [
                                    {
                                        "id": 1,
                                        "type": "RESERVATION_CONFIRMATION",
                                        "message": "Reservation confirmed",
                                        "created_at": "2024-02-12T13:00:00",
                                        "is_read": True
                                    }
                                ],
                                "total": 100,
                                "page": 1,
                                "per_page": 10
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
async def get_user_details(
    user_id: int,
    reservation_page: int = Query(1, gt=0),
    rating_page: int = Query(1, gt=0),
    notification_page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information about a specific user (Admin only).
    
    Returns:
    - Basic user information
    - User statistics
    - Reservation history
    - Penalty records
    - Rating history
    - Notification history
    
    Parameters:
    - **user_id**: ID of the user to retrieve
    - **reservation_page**: Page number for reservations pagination
    - **rating_page**: Page number for ratings pagination
    - **notification_page**: Page number for notifications pagination
    - **per_page**: Number of items per page (max 100)
    """
    check_admin_access(current_user)
    
    # Get user and check existence
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        APIError.not_found("User not found")
    
    # Get user statistics
    total_reservations = db.query(Reservation).filter(
        Reservation.user_id == user_id
    ).count()
    
    completed_reservations = db.query(Reservation).filter(
        Reservation.user_id == user_id,
        Reservation.status == ReservationStatus.COMPLETED
    ).count()
    
    cancelled_reservations = db.query(Reservation).filter(
        Reservation.user_id == user_id,
        Reservation.status == ReservationStatus.CANCELLED
    ).count()
    
    no_show_reservations = db.query(Reservation).filter(
        Reservation.user_id == user_id,
        Reservation.status == ReservationStatus.NO_SHOW
    ).count()
    
    completion_rate = (completed_reservations / total_reservations * 100) if total_reservations > 0 else 0
    
    # Get active and expired penalties
    now = datetime.utcnow()
    active_penalties = db.query(Penalty).filter(
        Penalty.user_id == user_id,
        Penalty.expires_at > now,
        Penalty.is_active == True
    ).all()
    
    expired_penalties = db.query(Penalty).filter(
        Penalty.user_id == user_id,
        Penalty.expires_at <= now
    ).all()
    
    # Get recent reservations with pagination
    reservations = db.query(Reservation).filter(
        Reservation.user_id == user_id
    ).order_by(Reservation.created_at.desc())\
        .offset((reservation_page - 1) * per_page)\
        .limit(per_page)\
        .all()
    
    # Get ratings with pagination
    ratings = db.query(Rating).filter(
        Rating.user_id == user_id
    ).order_by(Rating.created_at.desc())\
        .offset((rating_page - 1) * per_page)\
        .limit(per_page)\
        .all()
    
    total_ratings = db.query(Rating).filter(Rating.user_id == user_id).count()
    
    # Get notifications with pagination
    notifications = db.query(Notification).filter(
        Notification.user_id == user_id
    ).order_by(Notification.created_at.desc())\
        .offset((notification_page - 1) * per_page)\
        .limit(per_page)\
        .all()
    
    total_notifications = db.query(Notification).filter(
        Notification.user_id == user_id
    ).count()

    return {
        "success": True,
        "data": {
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "penalty_points": user.penalty_points,
                "average_rating": user.average_rating,
                "created_at": user.created_at,
                "last_login": user.last_login,
                "is_active": user.is_active,
                "profile_picture": user.profile_picture
            },
            "statistics": {
                "total_reservations": total_reservations,
                "completed_reservations": completed_reservations,
                "cancelled_reservations": cancelled_reservations,
                "no_show_reservations": no_show_reservations,
                "completion_rate": round(completion_rate, 2),
                "total_penalties": len(active_penalties) + len(expired_penalties),
                "active_penalties": len(active_penalties),
                "total_ratings": total_ratings,
                "has_restrictions": user.penalty_points >= 5
            },
            "reservations": {
                "recent": [
                    {
                        "id": r.id,
                        "space": {
                            "id": r.space.id,
                            "name": r.space.name,
                            "location": r.space.location
                        },
                        "start_time": r.start_time,
                        "end_time": r.end_time,
                        "status": r.status,
                        "check_in_time": r.check_in_time,
                        "check_out_time": r.check_out_time,
                        "rating": {
                            "rating": r.rating[0].rating,
                            "comment": r.rating[0].comment
                        } if r.rating else None
                    }
                    for r in reservations
                ],
                "total": total_reservations,
                "page": reservation_page,
                "per_page": per_page
            },
            "penalties": {
                "active": [
                    {
                        "id": p.id,
                        "type": p.type,
                        "points": p.points,
                        "description": p.description,
                        "created_at": p.created_at,
                        "expires_at": p.expires_at
                    }
                    for p in active_penalties
                ],
                "expired": [
                    {
                        "id": p.id,
                        "type": p.type,
                        "points": p.points,
                        "description": p.description,
                        "created_at": p.created_at,
                        "expires_at": p.expires_at
                    }
                    for p in expired_penalties
                ]
            },
            "ratings": {
                "received": [
                    {
                        "id": r.id,
                        "rating": r.rating,
                        "comment": r.comment,
                        "created_at": r.created_at,
                        "reservation_id": r.reservation_id
                    }
                    for r in ratings
                ],
                "total": total_ratings,
                "page": rating_page,
                "per_page": per_page
            },
            "notifications": {
                "recent": [
                    {
                        "id": n.id,
                        "type": n.type,
                        "message": n.message,
                        "created_at": n.created_at,
                        "is_read": n.is_read
                    }
                    for n in notifications
                ],
                "total": total_notifications,
                "page": notification_page,
                "per_page": per_page
            }
        }
    }

@router.get(
    "/notifications",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved notifications",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "notifications": [
                                {
                                    "id": 1,
                                    "user": {
                                        "id": 1,
                                        "name": "John Doe",
                                        "email": "user@example.com"
                                    },
                                    "type": "RESERVATION_CONFIRMATION",
                                    "message": "Reservation confirmed",
                                    "created_at": "2024-02-12T13:00:00",
                                    "is_read": True,
                                    "reference_id": 1,
                                    "reference_type": "reservation"
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
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def list_notifications(
    type: Optional[str] = None,
    is_read: Optional[bool] = None,
    user_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all notifications with filtering options (Admin only).
    
    Parameters:
    - **type**: Filter by notification type
    - **is_read**: Filter by read status
    - **user_id**: Filter by user
    - **start_date**: Filter by start date (UTC)
    - **end_date**: Filter by end date (UTC)
    - **page**: Page number for pagination
    - **per_page**: Number of items per page (max 100)
    """
    check_admin_access(current_user)
    
    query = db.query(Notification)
    
    # Apply filters
    if type:
        query = query.filter(Notification.type == type)
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    if user_id:
        query = query.filter(Notification.user_id == user_id)
    if start_date:
        query = query.filter(Notification.created_at >= start_date)
    if end_date:
        query = query.filter(Notification.created_at <= end_date)
    
    total = query.count()
    notifications = query.order_by(Notification.created_at.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()
    
    return {
        "success": True,
        "data": {
            "notifications": [
                {
                    "id": n.id,
                    "user": {
                        "id": n.user.id,
                        "name": n.user.name,
                        "email": n.user.email
                    },
                    "type": n.type,
                    "message": n.message,
                    "created_at": n.created_at,
                    "is_read": n.is_read,
                    "reference_id": n.reference_id,
                    "reference_type": n.reference_type
                }
                for n in notifications
            ],
            "total": total,
            "page": page,
            "per_page": per_page
        }
    }

@router.get(
    "/penalties/{penalty_id}",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved penalty details",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "penalty": {
                                "id": 1,
                                "user": {
                                    "id": 1,
                                    "name": "John Doe",
                                    "email": "user@example.com"
                                },
                                "type": "NO_SHOW",
                                "points": 2,
                                "description": "Missed reservation",
                                "created_at": "2024-02-12T13:00:00",
                                "expires_at": "2024-03-12T13:00:00",
                                "is_active": True,
                                "reservation": {
                                    "id": 1,
                                    "space": {
                                        "id": 1,
                                        "name": "Study Room A"
                                    },
                                    "start_time": "2024-02-12T13:00:00"
                                }
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
async def get_penalty_details(
    penalty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Get detailed information about a specific penalty (Admin only).
    
    Parameters:
    - **penalty_id**: ID of the penalty to retrieve
    """
    check_admin_access(current_user)
    
    penalty = db.query(Penalty).filter(Penalty.id == penalty_id).first()
    if not penalty:
        APIError.not_found("Penalty not found")
    
    return {
        "success": True,
        "data": {
            "penalty": {
                "id": penalty.id,
                "user": {
                    "id": penalty.user.id,
                    "name": penalty.user.name,
                    "email": penalty.user.email
                },
                "type": penalty.type,
                "points": penalty.points,
                "description": penalty.description,
                "created_at": penalty.created_at,
                "expires_at": penalty.expires_at,
                "is_active": penalty.is_active,
                "reservation": {
                    "id": penalty.reservation.id,
                    "space": {
                        "id": penalty.reservation.space.id,
                        "name": penalty.reservation.space.name
                    },
                    "start_time": penalty.reservation.start_time
                } if penalty.reservation else None
            }
        }
    }

@router.get(
    "/penalties",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved penalties",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "penalties": [
                                {
                                    "id": 1,
                                    "user": {
                                        "id": 1,
                                        "name": "John Doe",
                                        "email": "user@example.com"
                                    },
                                    "type": "NO_SHOW",
                                    "points": 2,
                                    "description": "Missed reservation",
                                    "created_at": "2024-02-12T13:00:00",
                                    "expires_at": "2024-03-12T13:00:00",
                                    "is_active": True,
                                    "reservation_id": 1
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
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def list_penalties(
    type: Optional[str] = None,
    is_active: Optional[bool] = None,
    user_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all penalties with filtering options (Admin only).
    
    Parameters:
    - **type**: Filter by penalty type
    - **is_active**: Filter by active status
    - **user_id**: Filter by user
    - **start_date**: Filter by start date (UTC)
    - **end_date**: Filter by end date (UTC)
    - **page**: Page number for pagination
    - **per_page**: Number of items per page (max 100)
    """
    check_admin_access(current_user)
    
    query = db.query(Penalty)
    
    # Apply filters
    if type:
        query = query.filter(Penalty.type == type)
    if is_active is not None:
        query = query.filter(Penalty.is_active == is_active)
    if user_id:
        query = query.filter(Penalty.user_id == user_id)
    if start_date:
        query = query.filter(Penalty.created_at >= start_date)
    if end_date:
        query = query.filter(Penalty.created_at <= end_date)
    
    total = query.count()
    penalties = query.order_by(Penalty.created_at.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()
    
    return {
        "success": True,
        "data": {
            "penalties": [
                {
                    "id": p.id,
                    "user": {
                        "id": p.user.id,
                        "name": p.user.name,
                        "email": p.user.email
                    },
                    "type": p.type,
                    "points": p.points,
                    "description": p.description,
                    "created_at": p.created_at,
                    "expires_at": p.expires_at,
                    "is_active": p.is_active,
                    "reservation_id": p.reservation_id
                }
                for p in penalties
            ],
            "total": total,
            "page": page,
            "per_page": per_page
        }
    }

@router.get(
    "/ratings",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved ratings",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "ratings": [
                                {
                                    "id": 1,
                                    "user": {
                                        "id": 1,
                                        "name": "John Doe",
                                        "email": "user@example.com"
                                    },
                                    "rating": 5,
                                    "comment": "Excellent space usage",
                                    "created_at": "2024-02-12T15:00:00",
                                    "reservation_id": 1,
                                    "rated_by": {
                                        "id": 2,
                                        "name": "Admin User"
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
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def list_ratings(
    rating_value: Optional[int] = None,
    user_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all ratings with filtering options (Admin only).
    
    Parameters:
    - **rating_value**: Filter by rating value (1-5)
    - **user_id**: Filter by user
    - **start_date**: Filter by start date (UTC)
    - **end_date**: Filter by end date (UTC)
    - **page**: Page number for pagination
    - **per_page**: Number of items per page (max 100)
    """
    check_admin_access(current_user)
    
    query = db.query(Rating)
    
    # Apply filters
    if rating_value:
        query = query.filter(Rating.rating == rating_value)
    if user_id:
        query = query.filter(Rating.user_id == user_id)
    if start_date:
        query = query.filter(Rating.created_at >= start_date)
    if end_date:
        query = query.filter(Rating.created_at <= end_date)
    
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
                    "user": {
                        "id": r.user.id,
                        "name": r.user.name,
                        "email": r.user.email
                    },
                    "rating": r.rating,
                    "comment": r.comment,
                    "created_at": r.created_at,
                    "reservation_id": r.reservation_id,
                    "rated_by": {
                        "id": r.rater.id,
                        "name": r.rater.name
                    } if r.rated_by else None
                }
                for r in ratings
            ],
            "total": total,
            "page": page,
            "per_page": per_page
        }
    }

@router.get(
    "/reservations/{reservation_id}",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved reservation details",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "reservation": {
                                "id": 1,
                                "user": {
                                    "id": 1,
                                    "name": "John Doe",
                                    "email": "user@example.com"
                                },
                                "space": {
                                    "id": 1,
                                    "name": "Study Room A",
                                    "location": "Building A"
                                },
                                "start_time": "2024-02-12T13:00:00",
                                "end_time": "2024-02-12T15:00:00",
                                "status": "COMPLETED",
                                "check_in_time": "2024-02-12T13:05:00",
                                "check_out_time": "2024-02-12T14:55:00",
                                "created_at": "2024-02-12T10:00:00",
                                "notes": "Study session",
                                "rating": {
                                    "rating": 5,
                                    "comment": "Great space"
                                }
                            }
                        }
                    }
                }
            }
        },
        403: {"description": "Not authorized (Admin only)"},
        404: {"description": "Reservation not found"}
    }
)
async def get_reservation_details(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Get detailed information about a specific reservation (Admin only).
    
    Parameters:
    - **reservation_id**: ID of the reservation to retrieve
    """
    check_admin_access(current_user)
    
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        APIError.not_found("Reservation not found")
    
    return {
        "success": True,
        "data": {
            "reservation": {
                "id": reservation.id,
                "user": {
                    "id": reservation.user.id,
                    "name": reservation.user.name,
                    "email": reservation.user.email
                },
                "space": {
                    "id": reservation.space.id,
                    "name": reservation.space.name,
                    "location": reservation.space.location
                },
                "start_time": reservation.start_time,
                "end_time": reservation.end_time,
                "status": reservation.status,
                "check_in_time": reservation.check_in_time,
                "check_out_time": reservation.check_out_time,
                "created_at": reservation.created_at,
                "notes": reservation.notes,
                "rating": {
                    "rating": reservation.rating[0].rating,
                    "comment": reservation.rating[0].comment
                } if reservation.rating else None
            }
        }
    }

@router.get(
    "/reservations",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved reservations",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "reservations": [
                                {
                                    "id": 1,
                                    "user": {
                                        "id": 1,
                                        "name": "John Doe",
                                        "email": "user@example.com"
                                    },
                                    "space": {
                                        "id": 1,
                                        "name": "Study Room A",
                                        "location": "Building A"
                                    },
                                    "start_time": "2024-02-12T13:00:00",
                                    "end_time": "2024-02-12T15:00:00",
                                    "status": "COMPLETED",
                                    "check_in_time": "2024-02-12T13:05:00",
                                    "check_out_time": "2024-02-12T14:55:00",
                                    "created_at": "2024-02-12T10:00:00"
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
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def list_reservations(
    status: Optional[ReservationStatus] = None,
    user_id: Optional[int] = None,
    space_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all reservations with filtering options (Admin only).
    
    Parameters:
    - **status**: Filter by reservation status
    - **user_id**: Filter by user
    - **space_id**: Filter by space
    - **start_date**: Filter by start date (UTC)
    - **end_date**: Filter by end date (UTC)
    - **page**: Page number for pagination
    - **per_page**: Number of items per page (max 100)
    """
    check_admin_access(current_user)
    
    query = db.query(Reservation)
    
    # Apply filters
    if status:
        query = query.filter(Reservation.status == status)
    if user_id:
        query = query.filter(Reservation.user_id == user_id)
    if space_id:
        query = query.filter(Reservation.space_id == space_id)
    if start_date:
        query = query.filter(Reservation.start_time >= start_date)
    if end_date:
        query = query.filter(Reservation.end_time <= end_date)
    
    total = query.count()
    reservations = query.order_by(Reservation.created_at.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()
    
    return {
        "success": True,
        "data": {
            "reservations": [
                {
                    "id": r.id,
                    "user": {
                        "id": r.user.id,
                        "name": r.user.name,
                        "email": r.user.email
                    },
                    "space": {
                        "id": r.space.id,
                        "name": r.space.name,
                        "location": r.space.location
                    },
                    "start_time": r.start_time,
                    "end_time": r.end_time,
                    "status": r.status,
                    "check_in_time": r.check_in_time,
                    "check_out_time": r.check_out_time,
                    "created_at": r.created_at
                }
                for r in reservations
            ],
            "total": total,
            "page": page,
            "per_page": per_page
        }
    }

@router.post(
    "/users",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {
            "description": "Admin user successfully created",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "user": {
                                "id": 1,
                                "email": "admin@example.com",
                                "name": "Admin User",
                                "role": "ADMIN",
                                "created_at": "2024-02-12T13:00:00"
                            }
                        }
                    }
                }
            }
        },
        400: {"description": "Email already registered"},
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def create_admin_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new admin user (Admin only).
    
    Parameters:
    - **email**: Valid email address
    - **name**: User's full name
    - **password**: Strong password
    """
    check_admin_access(current_user)
    
    # Check if email exists
    if db.query(User).filter(User.email == user.email).first():
        APIError.bad_request("Email already registered")
    
    # Create admin user
    hashed_password = pwd_context.hash(user.password)
    db_user = User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password,
        role=UserRole.ADMIN
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return {
        "success": True,
        "data": {
            "user": {
                "id": db_user.id,
                "email": db_user.email,
                "name": db_user.name,
                "role": db_user.role,
                "created_at": db_user.created_at
            }
        }
    }

class UserRoleUpdate(BaseModel):
    role: UserRole

class UserStatusUpdate(BaseModel):
    is_active: bool

class UserPenaltyReset(BaseModel):
    deactivate_penalties: bool = True

@router.put(
    "/users/{user_id}/role",
    response_model=dict,
    responses={
        200: {
            "description": "User role successfully updated",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "user": {
                                "id": 1,
                                "email": "user@example.com",
                                "name": "John Doe",
                                "role": "ADMIN"
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
async def update_user_role(
    user_id: int,
    role_update: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a user's role (Admin only).
    
    Parameters:
    - **user_id**: ID of the user to update
    - **role_update**: New role information
    """
    check_admin_access(current_user)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        APIError.not_found("User not found")
    
    user.role = role_update.role
    db.commit()
    
    return {
        "success": True,
        "data": {
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role
            }
        }
    }

@router.put(
    "/users/{user_id}/status",
    response_model=dict,
    responses={
        200: {
            "description": "User status successfully updated",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "user": {
                                "id": 1,
                                "email": "user@example.com",
                                "name": "John Doe",
                                "is_active": True
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
async def update_user_status(
    user_id: int,
    status_update: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Activate or deactivate a user (Admin only).
    
    Parameters:
    - **user_id**: ID of the user to update
    - **status_update**: New status information
    """
    check_admin_access(current_user)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        APIError.not_found("User not found")
    
    user.is_active = status_update.is_active
    db.commit()
    
    return {
        "success": True,
        "data": {
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "is_active": user.is_active
            }
        }
    }

@router.put(
    "/users/{user_id}/reset-penalties",
    response_model=dict,
    responses={
        200: {
            "description": "User penalties successfully reset",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "user": {
                                "id": 1,
                                "email": "user@example.com",
                                "name": "John Doe",
                                "penalty_points": 0,
                                "active_penalties": 0
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
async def reset_user_penalties(
    user_id: int,
    penalty_reset: UserPenaltyReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reset a user's penalty points and optionally deactivate existing penalties (Admin only).
    
    Parameters:
    - **user_id**: ID of the user to update
    - **deactivate_penalties**: Whether to deactivate existing penalties (default: True)
    """
    check_admin_access(current_user)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        APIError.not_found("User not found")
    
    # Reset penalty points
    user.penalty_points = 0
    
    # Optionally deactivate existing penalties
    if penalty_reset.deactivate_penalties:
        db.query(Penalty).filter(
            Penalty.user_id == user_id,
            Penalty.is_active == True
        ).update({"is_active": False})
    
    db.commit()
    
    active_penalties = db.query(Penalty).filter(
        Penalty.user_id == user_id,
        Penalty.is_active == True
    ).count()
    
    return {
        "success": True,
        "data": {
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "penalty_points": user.penalty_points,
                "active_penalties": active_penalties
            }
        }
    }

@router.get(
    "/reports/utilization",
    response_model=dict,
    responses={
        200: {
            "description": "Successfully retrieved utilization report",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "period": {
                                "start": "2024-02-05T00:00:00",
                                "end": "2024-02-12T00:00:00"
                            },
                            "space_utilization": [
                                {
                                    "space_id": 1,
                                    "name": "Study Room A",
                                    "total_reservations": 50,
                                    "reserved_hours": 100,
                                    "utilization_rate": 75.5
                                }
                            ],
                            "summary": {
                                "total_spaces": 20,
                                "average_utilization": 65.5
                            }
                        }
                    }
                }
            }
        },
        403: {"description": "Not authorized (Admin only)"}
    }
)
async def get_utilization_report(
    start_date: datetime,
    end_date: datetime,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get space utilization report for a specific period (Admin only).
    
    - **start_date**: Start date for the report period (UTC)
    - **end_date**: End date for the report period (UTC)
    
    Returns:
    - Utilization statistics for each space
    - Overall utilization summary
    """
    check_admin_access(current_user)

    # Ensure timezone-aware comparisons by converting database timestamps to UTC
    spaces = db.query(Space).filter(Space.is_active == True).all()
    space_stats = []

    for space in spaces:
        total_hours = (end_date - start_date).total_seconds() / 3600
        reservations = db.query(Reservation).filter(
            Reservation.space_id == space.id,
            Reservation.start_time >= start_date,
            Reservation.end_time <= end_date,
            Reservation.status.in_([ReservationStatus.COMPLETED, ReservationStatus.CHECKED_IN])
        ).all()

        # Convert database timestamps to UTC for comparison
        reserved_hours = sum(
            (min(r.end_time.replace(tzinfo=timezone.utc), end_date) - 
             max(r.start_time.replace(tzinfo=timezone.utc), start_date)).total_seconds() / 3600
            for r in reservations
        )

        utilization_rate = (reserved_hours / total_hours * 100) if total_hours > 0 else 0
        
        space_stats.append({
            "space_id": space.id,
            "name": space.name,
            "total_reservations": len(reservations),
            "reserved_hours": round(reserved_hours, 2),
            "utilization_rate": round(utilization_rate, 2)
        })

    return {
        "success": True,
        "data": {
            "period": {
                "start": start_date,
                "end": end_date
            },
            "space_utilization": space_stats,
            "summary": {
                "total_spaces": len(spaces),
                "average_utilization": round(
                    sum(s["utilization_rate"] for s in space_stats) / len(spaces)
                    if spaces else 0,
                    2
                )
            }
        }
    }
