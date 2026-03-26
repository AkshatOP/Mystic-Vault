FROM mcr.microsoft.com/playwright/python:v1.42.0-jammy

# Note: The Microsoft Playwright image already contains Python and the necessary browser dependencies.

# Install Node.js (for React frontend)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# 1. Install Python Backend Dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# 2. Install Node.js Frontend Dependencies
COPY package*.json ./
RUN npm install

# 3. Copy the rest of the code
COPY . .

# 4. Make the start script executable
# We're creating a custom docker-entrypoint to run both without venv issues
RUN chmod +x docker-entrypoint.sh

# Expose the ports for FastAPI and Vite (React)
EXPOSE 8000
EXPOSE 5173

# Start both frontend and backend
CMD ["./docker-entrypoint.sh"]
