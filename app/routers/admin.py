from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (Penalty, Rating, Reservation, ReservationStatus, Space,
                      SpaceStatus, User, UserRole)
from ..utils.error_handler import APIError
from .auth import get_current_user

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
@router.get("/dashboard", response_model=dict)
async def get_dashboard_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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

@router.get("/users", response_model=dict)
async def list_users(
    search: Optional[str] = None,
    role: Optional[UserRole] = None,
    has_penalties: Optional[bool] = None,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)

    query = db.query(User)

    # Apply filters
    if search:
        query = query.filter(
            User.name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
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

@router.get("/reports/utilization", response_model=dict)
async def get_utilization_report(
    start_date: datetime,
    end_date: datetime,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)

    # Space utilization
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

        reserved_hours = sum(
            (min(r.end_time, end_date) - max(r.start_time, start_date)).total_seconds() / 3600
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
