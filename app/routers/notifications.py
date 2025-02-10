from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from ..database import get_db
from ..models import User, Notification, NotificationType
from .auth import get_current_user

router = APIRouter()

# Pydantic models
class NotificationResponse(BaseModel):
    id: int
    type: NotificationType
    message: str
    reference_id: Optional[int]
    reference_type: Optional[str]
    created_at: datetime
    read_at: Optional[datetime]
    is_read: bool

    class Config:
        from_attributes = True

# Routes
@router.get("/", response_model=dict)
async def list_notifications(
    unread_only: bool = False,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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
            "notifications": [
                {
                    "id": n.id,
                    "type": n.type,
                    "message": n.message,
                    "created_at": n.created_at,
                    "read": n.is_read,
                    "reference_id": n.reference_id,
                    "reference_type": n.reference_type
                }
                for n in notifications
            ],
            "unread_count": unread_count,
            "total": total,
            "page": page,
            "per_page": per_page
        }
    }

@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    notification.mark_as_read()
    db.commit()

    return {
        "success": True,
        "message": "Notification marked as read"
    }

@router.post("/read-all")
async def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({
        "is_read": True,
        "read_at": datetime.utcnow()
    })
    db.commit()

    return {
        "success": True,
        "message": "All notifications marked as read"
    }
