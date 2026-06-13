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

# Copy dependency manifests
COPY package*.json ./

# Install packages (npm ci ensures clean reproducible installation)
RUN npm ci --only=production

# Copy server code
COPY . .

# Configure environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=./src/database/healthos.db
ENV UPLOADS_DIR=./uploads

# Expose backend port
EXPOSE 8080

# Run Express server
CMD ["node", "index.js"]
