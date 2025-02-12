# Import Base from database to help with migrations
from ..database import Base, engine
from .notifications import Notification, NotificationType
from .penalties import Penalty, PenaltyType
from .ratings import Rating
from .reservations import Reservation, ReservationStatus
from .spaces import Space, SpaceStatus, SpaceType
from .users import User, UserRole


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
