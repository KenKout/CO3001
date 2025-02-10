from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
import qrcode
import io
import base64

from ..database import get_db
from ..models import (
    User, Space, Reservation, ReservationStatus, 
    SpaceStatus, Notification, NotificationType
)
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
@router.post("/", response_model=dict)
async def create_reservation(
    reservation: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if user has too many active reservations
    active_reservations = db.query(Reservation).filter(
        Reservation.user_id == current_user.id,
        Reservation.status.in_([ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN])
    ).count()
    
    if active_reservations >= 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum number of active reservations reached"
        )

    # Validate space
    space = db.query(Space).filter(Space.id == reservation.space_id).first()
    if not space or not space.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Space not found or inactive"
        )

    # Validate times
    now = datetime.utcnow()
    if reservation.start_time < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start time must be in the future"
        )
    
    if reservation.end_time <= reservation.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time"
        )

    # Check for conflicts
    if check_reservation_conflicts(db, space.id, reservation.start_time, reservation.end_time):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Space is already reserved for this time"
        )

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

@router.post("/{reservation_id}/check-in")
async def check_in(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found"
        )

    # Verify user owns the reservation
    if reservation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to check in for this reservation"
        )

    # Check if reservation can be checked in
    now = datetime.utcnow()
    check_in_deadline = reservation.start_time + timedelta(minutes=15)
    
    if reservation.status != ReservationStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reservation cannot be checked in"
        )
    
    if now > check_in_deadline:
        # Mark as no-show
        reservation.status = ReservationStatus.NO_SHOW
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Check-in deadline passed"
        )

    # Perform check-in
    reservation.status = ReservationStatus.CHECKED_IN
    reservation.check_in_time = now
    db.commit()

    return {
        "success": True,
        "message": "Successfully checked in"
    }

@router.post("/{reservation_id}/check-out")
async def check_out(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found"
        )

    if reservation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to check out for this reservation"
        )

    if reservation.status != ReservationStatus.CHECKED_IN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reservation is not checked in"
        )

    # Perform check-out
    reservation.status = ReservationStatus.COMPLETED
    reservation.check_out_time = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": "Successfully checked out"
    }

@router.delete("/{reservation_id}")
async def cancel_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reservation not found"
        )

    if reservation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this reservation"
        )

    # Check cancellation time limit (24 hours before start)
    if datetime.utcnow() > (reservation.start_time - timedelta(hours=24)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cancellation must be done at least 24 hours before start time"
        )

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

@router.get("/", response_model=dict)
async def list_reservations(
    status: Optional[ReservationStatus] = None,
    page: int = Query(1, gt=0),
    per_page: int = Query(10, gt=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
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
