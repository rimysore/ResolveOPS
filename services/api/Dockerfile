FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY pyproject.toml README.md ./
COPY resolveops ./resolveops
RUN pip install --no-cache-dir .

EXPOSE 8000
CMD ["uvicorn", "resolveops.api:app", "--host", "0.0.0.0", "--port", "8000"]

