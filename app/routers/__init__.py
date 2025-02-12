from .admin import router as admin
from .auth import router as auth
from .notifications import router as notifications
from .penalties import router as penalties
from .ratings import router as ratings
from .reservations import router as reservations
from .spaces import router as spaces

__all__ = [
    'auth',
    'spaces',
    'reservations',
    'ratings',
    'penalties',
    'admin',
    'notifications'
]
