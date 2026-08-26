from fastapi import HTTPException


def api_error(status_code: int, message: str, code: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"success": False, "message": message, "code": code})
