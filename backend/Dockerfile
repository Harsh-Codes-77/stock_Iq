FROM python:3.12-slim

# Install system dependencies for WeasyPrint rendering, Matplotlib, and browser automation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    libffi-dev \
    libpango1.0-0 \
    libharfbuzz0b \
    libpangoft2-1.0-0 \
    libjpeg-dev \
    libopenjp2-7-dev \
    zlib1g-dev \
    libglib2.0-0 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and chromium browser binary with its system dependencies
RUN pip install playwright && playwright install chromium --with-deps

# Copy backend files
COPY . .

EXPOSE 8000

# Command to launch FastAPI ASGI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
