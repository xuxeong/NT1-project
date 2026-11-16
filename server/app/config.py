import os

PROJECT_NAME = "Neolix Mock Server"
PROJECT_VERSION = "0.1.0"
API_V1_PREFIX = "/api"

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

# Simulation settings
SIMULATION_INTERVAL_SEC = 1.0  # 1초마다 텔레메트리 갱신
DEFAULT_VEHICLE_SPEED_KMH = 15.0  # 기본 주행 속도 (15 km/h)
