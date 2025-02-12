from sqlalchemy import (CheckConstraint, Column, DateTime, ForeignKey, Integer,
                        String)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reservation_id = Column(Integer, ForeignKey("reservations.id", ondelete="CASCADE"), nullable=False)
    rated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # Admin who rated
    rating = Column(Integer, nullable=False)
    comment = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="ratings_received")
    rater = relationship("User", foreign_keys=[rated_by], backref="ratings_given")
    reservation = relationship("Reservation", backref="rating")

    # Ensure rating is between 1 and 5
    __table_args__ = (
        CheckConstraint('rating >= 1 AND rating <= 5', name='check_rating_range'),
    )

    def __repr__(self):
        return f"<Rating {self.id} - {self.rating}/5>"

    @property
    def is_admin_rating(self) -> bool:
        """Check if the rating was given by an admin"""
        return self.rated_by is not None
