# backend/api/__init__.py
from fastapi import APIRouter
from .tools import router as tools_router
from .threads import router as threads_router
from .models import router as models_router
from .tools_support import router as tools_support_router

router = APIRouter()
router.include_router(tools_router, prefix="/api")
router.include_router(threads_router, prefix="/api")
router.include_router(models_router, prefix="/api")

router.include_router(tools_support_router, prefix="/api")
