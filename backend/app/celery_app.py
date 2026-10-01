from celery import Celery
from app.config import settings

celery_app = Celery(
    "media_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,       # 10 minutos máximo por tarefa
    task_soft_time_limit=540,  # 9 minutos soft limit
    worker_prefetch_multiplier=1, # Pega 1 tarefa por vez para respeitar 2GB RAM
    worker_max_tasks_per_child=50 # Recicla processos para evitar memory leaks
)
