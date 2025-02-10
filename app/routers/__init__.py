from .auth import router as auth
from .spaces import router as spaces
from .reservations import router as reservations
from .ratings import router as ratings
from .penalties import router as penalties
from .admin import router as admin
from .notifications import router as notifications

__all__ = [
    'auth',
    'spaces',
    'reservations',
    'ratings',
    'penalties',
    'admin',
    'notifications'
]
