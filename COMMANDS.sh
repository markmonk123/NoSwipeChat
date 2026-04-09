#!/bin/bash
# Quick reference commands for NoSwipeChat inter-service communication

# ============================================================================
# VIEW SERVICES & HEALTH
# ============================================================================

# See all running containers
docker-compose ps

# View service logs
docker-compose logs backend        # Backend logs
docker-compose logs embeddings     # Embeddings service logs
docker-compose logs nginx          # Reverse proxy logs
docker-compose logs mongo          # Database logs
docker-compose logs -f             # Follow all logs

# Check specific service health
docker-compose exec backend curl http://embeddings:8000/health
docker-compose exec backend curl http://mongo:27017/
docker exec noswipechat-nginx curl http://backend:5000/health

# ============================================================================
# TEST INTER-SERVICE COMMUNICATION
# ============================================================================

# Test backend can reach embeddings
docker exec noswipechat-backend curl -X POST http://embeddings:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "test message"}'

# Test frontend can reach backend API through nginx
curl http://localhost:8080/api/health

# Test frontend can reach embeddings through nginx
curl -X POST http://localhost:8080/embeddings/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "test"}'

# Check backend status (includes embeddings health)
curl http://localhost:8080/api/status

# ============================================================================
# BUILD & DEPLOYMENT
# ============================================================================

# Build all services
docker-compose build

# Build specific service
docker-compose build backend
docker-compose build embeddings

# Start all services
docker-compose up -d

# Rebuild and restart
docker-compose up -d --build

# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes database)
docker-compose down -v

# ============================================================================
# NETWORK INSPECTION
# ============================================================================

# View the Docker network
docker network ls | grep noswipechat
docker network inspect noswipechat_noswipechat-network

# Check which services are on the network
docker network inspect noswipechat_noswipechat-network | grep "Name"

# Ping between containers (test DNS resolution)
docker exec noswipechat-backend ping embeddings    # Should work
docker exec noswipechat-backend ping mongo         # Should work
docker exec noswipechat-embeddings ping backend    # Should work

# ============================================================================
# DATABASE OPERATIONS
# ============================================================================

# Connect to MongoDB from backend
docker exec noswipechat-backend mongosh --host mongo

# View database collections
docker exec noswipechat-mongo mongosh --quiet --eval \
  "db.getSiblingDB('singles-chatroom').getCollectionNames()"

# ============================================================================
# SCALE SERVICES
# ============================================================================

# Run multiple instances of backend (simple load balancing)
# Note: Requires load balancer config in docker-compose
docker-compose up -d --scale backend=3

# View scaled instances
docker-compose ps

# ============================================================================
# COMMON ISSUES & DIAGNOSTICS
# ============================================================================

# Backend can't find embeddings
docker-compose logs backend | grep -i "embeddings\|error"

# Check if embeddings service crashed
docker-compose ps | grep embeddings

# View last 50 lines of embeddings logs
docker-compose logs embeddings | tail -50

# Check if network is accessible
docker exec noswipechat-backend getent hosts embeddings

# Verify environment variables in backend
docker exec noswipechat-backend printenv | grep EMBEDDINGS

# ============================================================================
# CLEANUP & MAINTENANCE
# ============================================================================

# Remove unused Docker images
docker image prune

# Remove unused volumes
docker volume prune

# Remove all stopped containers
docker container prune

# Full cleanup (remove images, containers, volumes)
docker system prune -a --volumes

# ============================================================================
# SERVICE PORTS (REFERENCE)
# ============================================================================
# nginx      - 8080  (EXPOSED - external access)
# backend    - 5000  (INTERNAL - only docker network)
# embeddings - 8000  (INTERNAL - only docker network)
# mongo      - 27017 (INTERNAL - only docker network)
# ============================================================================
