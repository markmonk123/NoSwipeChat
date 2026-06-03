# Stage 1: Builder
FROM python:3.11-slim AS builder

WORKDIR /app

ARG HF_MODEL_NAME=roberta-base
ENV HF_MODEL_NAME=${HF_MODEL_NAME}
ENV HF_HOME=/opt/huggingface
ENV TRANSFORMERS_CACHE=/opt/huggingface

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir \
    --disable-pip-version-check \
    -r requirements.txt

# Preload the Hugging Face model at build time so runtime can stay offline.
RUN python -c "from huggingface_hub import snapshot_download; import os; snapshot_download(repo_id=os.environ['HF_MODEL_NAME'], cache_dir=os.environ['HF_HOME'])"

# Stage 2: Runtime
FROM python:3.11-slim

WORKDIR /app

ARG HF_MODEL_NAME=roberta-base
ENV HF_MODEL_NAME=${HF_MODEL_NAME}
ENV HF_HOME=/opt/huggingface
ENV TRANSFORMERS_CACHE=/opt/huggingface

# Install runtime dependencies (libgomp for torch)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /opt/huggingface /opt/huggingface

# Copy application code
COPY main.py .

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health').read()"

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
