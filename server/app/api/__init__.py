from app.api.vehicles import router as vehicles_router
from app.api.dispatch import router as dispatch_router
from app.api.routes import router as routes_router
from app.api.managers import router as managers_router

__all__ = ["vehicles_router", "dispatch_router", "routes_router", "managers_router"]
