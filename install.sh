#!/usr/bin/env bash
set -e

echo "Starting UltraBarber CRM with Docker Compose..."
docker compose up --build -d

echo "UltraBarber CRM is starting. Backend should be available at http://localhost:4000"
