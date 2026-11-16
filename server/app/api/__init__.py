from app.api.vehicles import router as vehicles_router
from app.api.dispatch import router as dispatch_router
from app.api.routes import router as routes_router

__all__ = ["vehicles_router", "dispatch_router", "routes_router"]
