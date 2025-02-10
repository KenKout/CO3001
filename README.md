# Study Space Management System

A comprehensive system for managing study spaces with features including reservations, ratings, and penalties.

## Features

- User Authentication with JWT and Google OAuth
- Space Management and Real-time Availability
- Reservation System with QR Code Check-in
- Rating System for User Behavior
- Penalty System for Rule Violations
- Admin Dashboard with Analytics
- Real-time Notifications
- Comprehensive API Documentation

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, SQLite
- **Authentication**: JWT, Google OAuth 2.0
- **Database**: SQLite (easily upgradable to PostgreSQL)
- **Additional Tools**: QR Code Generation, Email Notifications

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd study-space-management
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Run the application:
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, you can access:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Main Endpoints

#### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `GET /auth/profile` - Get user profile

#### Spaces
- `GET /spaces` - List available spaces
- `GET /spaces/{id}` - Get space details
- `POST /spaces` - Create new space (admin)
- `PUT /spaces/{id}` - Update space (admin)
- `DELETE /spaces/{id}` - Delete space (admin)

#### Reservations
- `POST /reservations` - Create reservation
- `GET /reservations` - List user's reservations
- `GET /reservations/{id}` - Get reservation details
- `POST /reservations/{id}/check-in` - Check-in to reservation
- `POST /reservations/{id}/check-out` - Check-out from reservation
- `DELETE /reservations/{id}` - Cancel reservation

#### Ratings & Penalties
- `POST /admin/ratings` - Rate a user (admin)
- `GET /users/{id}/ratings` - Get user's ratings
- `GET /users/{id}/penalties` - Get user's penalties
- `POST /admin/penalties` - Assign penalty (admin)

#### Admin
- `GET /admin/dashboard` - Get dashboard statistics
- `GET /admin/users` - List all users
- `GET /admin/reports/utilization` - Get space utilization reports

## Business Rules

### Rating System
- Scale: 1-5 stars
- Only admins can rate users
- Ratings linked to specific reservations
- Average rating visible on profile

### Penalty System
- No-show: 2 points
- Late arrival: 1 point
- Damage: 3 points
- Points expire after 30 days
- 5+ points: booking restriction
- 8+ points: temporary suspension

### Reservation Rules
- Maximum 2 active reservations
- Check-in within 15 minutes
- Automatic cancellation on no-show
- 24-hour advance cancellation required

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
