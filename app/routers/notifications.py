from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Notification, NotificationType
from ..models.notifications import (NotificationCreate, NotificationResponse,
                                    NotificationUpdate)
from ..models.users import User
from ..utils.error_handler import APIError
from .auth import get_current_user

router = APIRouter()

@router.get(
    "",
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
                                    "type": "RESERVATION_CONFIRMATION",
                                    "message": "Reservation confirmed for Study Room A",
                                    "created_at": "2024-02-12T13:00:00",
                                    "read": False,
                                    "reference_id": 123,
                                    "reference_type": "reservation"
                                }
                            ],
                            "unread_count": 1,
                            "total": 1,
                            "page": 1,
                            "per_page": 10
                        }
                    }
                }
            }
        },
        401: {"description": "Not authenticated"}
    }
)
async def list_notifications(
    unread_only: bool = False,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    List notifications for the authenticated user.
    
    - **unread_only**: Filter to show only unread notifications
    - **page**: Page number for pagination (starts at 1)
    - **per_page**: Number of items per page (max 100)
    """
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    total = query.count()
    notifications = query.order_by(Notification.created_at.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()

    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()

    return {
        "success": True,
        "data": {
            "notifications": [NotificationResponse.from_orm(n) for n in notifications],
            "unread_count": unread_count,
            "total": total,
            "page": page,
            "per_page": per_page
        }
    }

@router.post(
    "/{notification_id}/read",
    responses={
        200: {
            "description": "Successfully marked notification as read",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Notification marked as read"
                    }
                }
            }
        },
        404: {"description": "Notification not found"}
    }
)
async def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Mark a specific notification as read.
    
    - **notification_id**: ID of the notification to mark as read
    """
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notification:
        APIError.not_found("Notification not found")

    update_data = NotificationUpdate(is_read=True)
    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(notification, key, value)
    
    if update_data.is_read:
        notification.read_at = datetime.utcnow()
    
    db.commit()

    return {
        "success": True,
        "message": "Notification marked as read"
    }

@router.post(
    "/read-all",
    responses={
        200: {
            "description": "Successfully marked all notifications as read",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "All notifications marked as read"
                    }
                }
            }
        }
    }
)
async def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Mark all unread notifications as read for the authenticated user.
    """
    update_data = NotificationUpdate(is_read=True)
    now = datetime.utcnow()
    
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({
        "is_read": update_data.is_read,
        "read_at": now
    })
    
    db.commit()

    return {
        "success": True,
        "message": "All notifications marked as read"
    }

@router.post(
    "",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {
            "description": "Notification created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "id": 1,
                            "type": "SYSTEM_NOTIFICATION",
                            "message": "System maintenance scheduled",
                            "user_id": 1,
                            "created_at": "2024-02-12T13:00:00"
                        }
                    }
                }
            }
        }
    }
)
async def create_notification(
    notification: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Create a new notification.
    
    - Requires appropriate permissions
    - Used internally by the system
    """
    db_notification = Notification(**notification.dict())
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    
    return {
        "success": True,
        "data": NotificationResponse.from_orm(db_notification)
    }
