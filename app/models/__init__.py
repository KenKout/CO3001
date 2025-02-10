from .users import User, UserRole
from .spaces import Space, SpaceType, SpaceStatus
from .reservations import Reservation, ReservationStatus
from .ratings import Rating
from .penalties import Penalty, PenaltyType
from .notifications import Notification, NotificationType

# Import Base from database to help with migrations
from ..database import Base, engine

# Create all tables
def init_db():
    """Initialize the database by creating all tables"""
    Base.metadata.create_all(bind=engine)

# List of all models for easy access
__all__ = [
    'User',
    'UserRole',
    'Space',
    'SpaceType',
    'SpaceStatus',
    'Reservation',
    'ReservationStatus',
    'Rating',
    'Penalty',
    'PenaltyType',
    'Notification',
    'NotificationType',
    'init_db'
]
