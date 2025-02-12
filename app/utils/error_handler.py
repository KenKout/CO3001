from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse


class CustomHTTPException(HTTPException):
    def __init__(self, status_code: int, content: dict):
        super().__init__(status_code=status_code, detail=content)
        self.content = content


async def http_exception_handler(request: Request, exc: CustomHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.content
    )


class APIError:
    @staticmethod
    def raise_error(code: int, message: str):
        error_content = {
            "success": False,
            "error": {
                "code": code,
                "message": message
            }
        }
        raise CustomHTTPException(status_code=code, content=error_content)

    @staticmethod
    def bad_request(message: str):
        APIError.raise_error(status.HTTP_400_BAD_REQUEST, message)

    @staticmethod
    def unauthorized(message: str = "Could not validate credentials"):
        APIError.raise_error(
            status.HTTP_401_UNAUTHORIZED, 
            message
        )

    @staticmethod
    def forbidden(message: str = "Not authorized to perform this action"):
        APIError.raise_error(status.HTTP_403_FORBIDDEN, message)

    @staticmethod
    def not_found(message: str = "Resource not found"):
        APIError.raise_error(status.HTTP_404_NOT_FOUND, message)