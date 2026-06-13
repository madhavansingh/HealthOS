#!/bin/bash

# ==============================================================================
# HealthOS Backend - Google Cloud Run Deployment Script
# ==============================================================================
# This script builds and deploys the backend container to Google Cloud Run.
# Run this from the repository root: ./scripts/deploy-cloud-run.sh
# Make sure you have the gcloud CLI installed and authenticated.

set -e

# --- Configuration ---
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
REGION="us-central1"
SERVICE_NAME="healthos-backend"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: Google Cloud Project ID is not configured."
  echo "Please run: gcloud config set project [YOUR_PROJECT_ID]"
  exit 1
fi

echo "=================================================="
echo "🚀 Deploying HealthOS Backend to Google Cloud Run"
echo "   Project ID: $PROJECT_ID"
echo "   Region:     $REGION"
echo "   Service:    $SERVICE_NAME"
echo "   Image:      $IMAGE_NAME"
echo "=================================================="

# 1. Build the Docker image locally (using the repository root as context)
echo -e "\n📦 Building Docker image..."
docker build -f server/Dockerfile -t $IMAGE_NAME .

# 2. Configure Docker authentication for Google Container Registry
echo -e "\n🔑 Configuring registry authorization..."
gcloud auth configure-docker --quiet

# 3. Push the image to Container Registry
echo -e "\n📤 Pushing image to Container Registry..."
docker push $IMAGE_NAME

# 4. Deploy the image to Cloud Run
# Note: GEMINI_API_KEY must be supplied. If it is already set in your terminal environment,
# it will be passed, otherwise it defaults to a placeholder.
GEMINI_KEY="${GEMINI_API_KEY:-your_gemini_api_key_here}"

echo -e "\n🚢 Deploying to Google Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,GEMINI_API_KEY=$GEMINI_KEY,PORT=8080" \
  --memory=1Gi \
  --cpu=1

echo "=================================================="
echo "✅ Deployment Successful!"
echo "   Verify service status via: gcloud run services describe $SERVICE_NAME --region $REGION"
echo "=================================================="
