from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from ..database import get_db
from ..env import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from ..models.users import (Token, TokenData, User, UserCreate, UserLogin,
                            UserResponse, UserRole)
from ..utils.error_handler import APIError

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class CustomHTTPBearer(HTTPBearer):
    async def __call__(self, request: Request) -> HTTPAuthorizationCredentials:
        try:
            return await super().__call__(request)
        except Exception:
            APIError.unauthorized("Not authenticated")

security = CustomHTTPBearer()

# Helper functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            APIError.unauthorized()
        token_data = TokenData(email=email)
    except JWTError:
        APIError.unauthorized()

    user = db.query(User).filter(User.email == token_data.email).first()
    if user is None:
        APIError.unauthorized()
    return user

# Routes
@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        APIError.bad_request("Email already registered")
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=dict)
async def login(
    user_credentials: UserLogin,
    db: Session = Depends(get_db)
):
    # Authenticate user
    user = db.query(User).filter(User.email == user_credentials.email).first()
    if not user or not verify_password(user_credentials.password, user.hashed_password):
        APIError.unauthorized("Incorrect email or password")
    
    # Create access token
    access_token = create_access_token(data={"sub": user.email})
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role,
                "penalty_points": user.penalty_points,
                "average_rating": user.average_rating
            }
        }
    }

@router.get("/profile", response_model=dict)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get user statistics
    total_reservations = len(current_user.reservations)
    completed_reservations = sum(1 for r in current_user.reservations if r.status == "completed")
    cancelled_reservations = sum(1 for r in current_user.reservations if r.status == "cancelled")
    no_show_reservations = sum(1 for r in current_user.reservations if r.status == "no_show")

    return {
        "success": True,
        "data": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "role": current_user.role,
            "created_at": current_user.created_at,
            "stats": {
                "total_reservations": total_reservations,
                "penalty_points": current_user.penalty_points,
                "average_rating": current_user.average_rating,
                "reservation_status": {
                    "completed": completed_reservations,
                    "cancelled": cancelled_reservations,
                    "no_show": no_show_reservations
                }
            }
        }
    }
