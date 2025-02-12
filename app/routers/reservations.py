import base64
import io
from datetime import datetime, timedelta
from typing import List, Optional

import qrcode
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (Notification, NotificationType, Reservation,
                      ReservationStatus, Space, SpaceStatus, User)
from ..utils.error_handler import APIError
from .auth import get_current_user

router = APIRouter()

# Pydantic models
class ReservationCreate(BaseModel):
    space_id: int
    start_time: datetime
    end_time: datetime

class ReservationResponse(BaseModel):
    id: int
    space: dict
    start_time: datetime
    end_time: datetime
    status: ReservationStatus
    qr_code: Optional[str]
    check_in_required_by: Optional[datetime]

    class Config:
        from_attributes = True

# Helper functions
def generate_qr_code(reservation_id: int) -> str:
    """Generate QR code for check-in"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(str(reservation_id))
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='PNG')
    img_str = base64.b64encode(img_buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

def check_reservation_conflicts(
    db: Session,
    space_id: int,
    start_time: datetime,
    end_time: datetime,
    exclude_reservation_id: Optional[int] = None
) -> bool:
    """Check for conflicting reservations"""
    query = db.query(Reservation).filter(
        Reservation.space_id == space_id,
        Reservation.status.in_([ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN]),
        and_(
            Reservation.start_time < end_time,
            Reservation.end_time > start_time
        )
    )
    
    if exclude_reservation_id:
        query = query.filter(Reservation.id != exclude_reservation_id)
    
    return query.count() > 0

def create_notification(
    db: Session,
    user_id: int,
    type: NotificationType,
    message: str,
    reference_id: Optional[int] = None,
    reference_type: Optional[str] = None
):
    """Create a notification"""
    notification = Notification(
        user_id=user_id,
        type=type,
        message=message,
        reference_id=reference_id,
        reference_type=reference_type
    )
    db.add(notification)
    db.commit()

# Routes
@router.post(
    "/",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {
            "description": "Reservation successfully created",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "data": {
                            "reservation_id": 1,
                            "space": {
                                "id": 1,
                                "name": "Study Room A"
                            },
                            "start_time": "2024-02-12T14:00:00",
                            "end_time": "2024-02-12T16:00:00",
                            "status": "CONFIRMED",
                            "qr_code": "data:image/png;base64,...",
                            "check_in_required_by": "2024-02-12T14:15:00"
                        }
                    }
                }
            }
        },
        400: {
            "description": "Bad request",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "BAD_REQUEST",
                            "message": "Space is already reserved for this time"
                        }
                    }
                }
            }
        },
        404: {"description": "Space not found"}
    }
)
async def create_reservation(
    reservation: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new reservation.
    
    - **space_id**: ID of the space to reserve
    - **start_time**: Start time of the reservation (UTC)
    - **end_time**: End time of the reservation (UTC)
    
    Notes:
    - Maximum 2 active reservations per user
    - Start time must be in the future
    - End time must be after start time
    - Space must be available during the requested time
    """
    # Check if user has too many active reservations
    active_reservations = db.query(Reservation).filter(
        Reservation.user_id == current_user.id,
        Reservation.status.in_([ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN])
    ).count()
    
    if active_reservations >= 2:
        APIError.bad_request("Maximum number of active reservations reached")

    # Validate space
    space = db.query(Space).filter(Space.id == reservation.space_id).first()
    if not space or not space.is_active:
        APIError.not_found("Space not found or inactive")

    # Validate times
    now = datetime.utcnow()
    if reservation.start_time < now:
        APIError.bad_request("Start time must be in the future")
    
    if reservation.end_time <= reservation.start_time:
        APIError.bad_request("End time must be after start time")

    # Check for conflicts
    if check_reservation_conflicts(db, space.id, reservation.start_time, reservation.end_time):
        APIError.bad_request("Space is already reserved for this time")

    # Create reservation
    db_reservation = Reservation(
        user_id=current_user.id,
        space_id=space.id,
        start_time=reservation.start_time,
        end_time=reservation.end_time,
        status=ReservationStatus.CONFIRMED
    )
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)

    # Generate QR code
    qr_code = generate_qr_code(db_reservation.id)
    db_reservation.qr_code = qr_code
    db.commit()

    # Create notification
    create_notification(
        db,
        current_user.id,
        NotificationType.RESERVATION_CONFIRMATION,
        f"Reservation confirmed for {space.name}",
        db_reservation.id,
        "reservation"
    )

    return {
        "success": True,
        "data": {
            "reservation_id": db_reservation.id,
            "space": {
                "id": space.id,
                "name": space.name
            },
            "start_time": db_reservation.start_time,
            "end_time": db_reservation.end_time,
            "status": db_reservation.status,
            "qr_code": qr_code,
            "check_in_required_by": db_reservation.start_time + timedelta(minutes=15)
        }
    }

@router.post(
    "/{reservation_id}/check-in",
    responses={
        200: {
            "description": "Successfully checked in",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Successfully checked in"
                    }
                }
            }
        },
        400: {
            "description": "Check-in not possible",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "error": {
                            "code": "BAD_REQUEST",
                            "message": "Check-in deadline passed"
                        }
                    }
                }
            }
        },
        404: {"description": "Reservation not found"}
    }
)
async def check_in(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check in to a reservation.
    
    - **reservation_id**: ID of the reservation to check in
    
    Notes:
    - Must check in within 15 minutes of start time
    - Reservation must be in CONFIRMED status
    """
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        APIError.not_found("Reservation not found")

    # Verify user owns the reservation
    if reservation.user_id != current_user.id:
        APIError.forbidden("Not authorized to check in for this reservation")

    # Check if reservation can be checked in
    now = datetime.utcnow()
    check_in_deadline = reservation.start_time + timedelta(minutes=15)
    
    if reservation.status != ReservationStatus.CONFIRMED:
        APIError.bad_request("Reservation cannot be checked in")
    
    if now > check_in_deadline:
        # Mark as no-show
        reservation.status = ReservationStatus.NO_SHOW
        db.commit()
        APIError.bad_request("Check-in deadline passed")

    # Perform check-in
    reservation.status = ReservationStatus.CHECKED_IN
    reservation.check_in_time = now
    db.commit()

    return {
        "success": True,
        "message": "Successfully checked in"
    }

@router.post(
    "/{reservation_id}/check-out",
    responses={
        200: {
            "description": "Successfully checked out",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Successfully checked out"
                    }
                }
            }
        },
        400: {"description": "Reservation is not checked in"},
        404: {"description": "Reservation not found"}
    }
)
async def check_out(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Check out from a reservation.
    
    - **reservation_id**: ID of the reservation to check out
    
    Notes:
    - Reservation must be in CHECKED_IN status
    """
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        APIError.not_found("Reservation not found")

    if reservation.user_id != current_user.id:
        APIError.forbidden("Not authorized to check out for this reservation")

    if reservation.status != ReservationStatus.CHECKED_IN:
        APIError.bad_request("Reservation is not checked in")

    # Perform check-out
    reservation.status = ReservationStatus.COMPLETED
    reservation.check_out_time = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": "Successfully checked out"
    }

@router.delete(
    "/{reservation_id}",
    responses={
        200: {
            "description": "Reservation successfully cancelled",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Reservation cancelled successfully"
                    }
                }
            }
        },
        400: {"description": "Cancellation deadline passed"},
        404: {"description": "Reservation not found"}
    }
)
async def cancel_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel a reservation.
    
    - **reservation_id**: ID of the reservation to cancel
    
    Notes:
    - Must cancel at least 24 hours before start time
    """
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        APIError.not_found("Reservation not found")

    if reservation.user_id != current_user.id:
        APIError.forbidden("Not authorized to cancel this reservation")

    # Check cancellation time limit (24 hours before start)
    if datetime.utcnow() > (reservation.start_time - timedelta(hours=24)):
        APIError.bad_request("Cancellation must be done at least 24 hours before start time")

    reservation.status = ReservationStatus.CANCELLED
    db.commit()

    # Create cancellation notification
    create_notification(
        db,
        current_user.id,
        NotificationType.RESERVATION_CANCELLED,
        f"Reservation for {reservation.space.name} has been cancelled",
        reservation.id,
        "reservation"
    )

    return {
        "success": True,
        "message": "Reservation cancelled successfully"
    }

@router.get(
    "/",
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
                                    "space": {
                                        "id": 1,
                                        "name": "Study Room A"
                                    },
                                    "start_time": "2024-02-12T14:00:00",
                                    "end_time": "2024-02-12T16:00:00",
                                    "status": "CONFIRMED",
                                    "check_in_time": None,
                                    "check_out_time": None,
                                    "qr_code": "data:image/png;base64,..."
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
async def list_reservations(
    status: Optional[ReservationStatus] = None,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List user's reservations.
    
    - **status**: Filter by reservation status
    - **page**: Page number for pagination (starts at 1)
    - **per_page**: Number of items per page (max 100)
    """
    query = db.query(Reservation).filter(Reservation.user_id == current_user.id)
    
    if status:
        query = query.filter(Reservation.status == status)
    
    total = query.count()
    reservations = query.order_by(Reservation.start_time.desc())\
        .offset((page - 1) * per_page)\
        .limit(per_page)\
        .all()

    return {
        "success": True,
        "data": {
            "reservations": [
                {
                    "id": r.id,
                    "space": {
                        "id": r.space.id,
                        "name": r.space.name
                    },
                    "start_time": r.start_time,
                    "end_time": r.end_time,
                    "status": r.status,
                    "check_in_time": r.check_in_time,
                    "check_out_time": r.check_out_time,
                    "qr_code": r.qr_code if r.status == ReservationStatus.CONFIRMED else None
                }
                for r in reservations
            ],
            "total": total,
            "page": page,
            "per_page": per_page
        }
    }
