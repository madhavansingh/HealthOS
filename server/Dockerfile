# HealthOS Backend Dockerfile
# To build this container, run the following command from the repository root:
# docker build -f server/Dockerfile -t healthos-backend .

# Use official Node.js slim image (lightweight runtime)
FROM node:20-slim

# Install system dependencies required for compiling better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /app

# Copy dependency manifests from server folder
COPY server/package*.json ./

# Install packages (npm ci ensures clean reproducible installation)
RUN npm ci --only=production

# Copy server code from server folder
COPY server/ .

# Copy the demo documents from root storage directory
COPY storage/demo-documents /app/storage/demo-documents

# Configure environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=./src/database/healthos.db
ENV UPLOADS_DIR=./uploads
ENV DEMO_DOCS_DIR=/app/storage/demo-documents

# Expose backend port
EXPOSE 8080

# Run Express server
CMD ["node", "index.js"]
