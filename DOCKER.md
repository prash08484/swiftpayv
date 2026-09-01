# SwiftPay - Docker Setup & Deployment Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Docker Commands Reference](#docker-commands-reference)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)
- [Advanced Configuration](#advanced-configuration)

---

## Prerequisites

Before you begin, make sure you have the following installed:

### Required
- **Docker** (version 20.10 or higher)
  - [Install Docker Desktop](https://www.docker.com/products/docker-desktop) (Win, Mac)
  - [Install Docker Engine](https://docs.docker.com/engine/install/) (Linux)
  
- **Docker Compose** (version 1.29 or higher)
  - Usually comes with Docker Desktop
  - Verify: `docker-compose --version`

### Optional
- **Git** for cloning the repository
- **VS Code** with Docker extension for container management

### Verify Installation
```bash
docker --version
docker-compose --version
docker run hello-world
```

---

## Quick Start

### 1. Clone and Navigate to Project
```bash
git clone <repository-url>
cd SwiftPay
```

### 2. Create Environment File
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
# For local development, defaults should work fine
```

### 3. Build and Start All Containers
```bash
docker-compose up -d
```

### 4. Verify All Services Are Running
```bash
docker-compose ps
```

Expected output:
```
NAME                  STATUS              PORTS
swiftpay-frontend     Up (healthy)        3000->3000/tcp
swiftpay-backend      Up (healthy)        8080->8080/tcp
swiftpay-mongodb      Up (healthy)        27017->27017/tcp
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/api/v1
- **MongoDB**: mongodb://admin:password@localhost:27017/SwiftPayDB

---

## Configuration

### Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/SwiftPayDB
MONGODB_USER=admin
MONGODB_PASSWORD=your_secure_password_here

# Server Configuration
PORT=8080
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_very_secure_jwt_secret_key_here

# Email Configuration (Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# OTP Expiry in seconds
OTP_EXPIRY=120
```

### Docker Compose Environment

The `docker-compose.yml` file automatically reads from `.env` and passes variables to containers.

**Key Services:**
- **MongoDB**: Automatically initializes with root credentials
- **Backend**: Connects to MongoDB using credentials from .env
- **Frontend**: Connects to backend API

---

## Running the Application

### Development Mode

```bash
# Start all services
docker-compose up -d

# View logs in real-time
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### Production Mode

Before deploying, update `.env` with production settings:

```env
NODE_ENV=production
JWT_SECRET=long_random_secure_string_min_32_chars
MONGODB_PASSWORD=very_strong_password
EMAIL_PASSWORD=your_app_password
```

Then start:
```bash
docker-compose up -d
```

### Rebuild and Restart

If you make code changes:

```bash
# Rebuild images and restart
docker-compose up --build -d

# Or rebuild without cache
docker-compose up --build --no-cache -d
```

---

## Docker Commands Reference

### Container Management

```bash
# Start all services
docker-compose up -d

# Stop all services (containers remain)
docker-compose stop

# Restart services
docker-compose restart

# Remove containers
docker-compose down

# Remove containers and volumes
docker-compose down -v

# Remove containers, volumes, and images
docker-compose down -v --rmi=all
```

### Viewing Status and Logs

```bash
# Show running containers
docker-compose ps

# Show all containers (including stopped)
docker-compose ps -a

# View logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb

# Show last 100 lines
docker-compose logs --tail=100
```

### Executing Commands in Containers

```bash
# Execute command in backend container
docker-compose exec backend npm list

# Access backend container shell
docker-compose exec backend /bin/sh

# Access frontend container shell
docker-compose exec frontend /bin/sh

# Access MongoDB shell
docker-compose exec mongodb mongosh -u admin -p password --authenticationDatabase admin
```

### Building Images

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend

# Build without cache
docker-compose build --no-cache
```

### Cleanup

```bash
# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Complete cleanup
docker system prune -a --volumes
```

---

## Troubleshooting

### Port Already in Use

If you get error: "Port 8080 is already allocated"

```bash
# Find what's using the port (Windows)
netstat -ano | findstr :8080

# Change port in docker-compose.yml or .env
# Or kill the process using the port
```

### MongoDB Connection Issues

```bash
# Check MongoDB logs
docker-compose logs mongodb

# Verify MongoDB is running
docker-compose ps mongodb

# Test connection
docker-compose exec backend npm list mongoose

# Reset MongoDB data
docker-compose down -v mongodb
docker-compose up -d mongodb
```

### Backend Not Connecting to MongoDB

```bash
# Verify connection string
docker-compose exec backend cat .env | grep MONGO

# Check backend logs
docker-compose logs -f backend

# Ensure MongoDB is healthy
docker-compose exec backend curl http://mongodb:27017
```

### Frontend Can't Connect to Backend

```bash
# Check if backend is running
docker-compose ps backend

# Test backend from frontend container
docker-compose exec frontend wget http://backend:8080

# Check CORS settings
# Verify FRONTEND_URL in backend .env

# Frontend logs
docker-compose logs -f frontend
```

### Container Keeps Crashing

```bash
# Check logs
docker-compose logs <service-name>

# Verify image built correctly
docker-compose build --no-cache <service-name>

# Check resource allocation
# Increase Docker Desktop memory/CPU allocation
# Settings → Resources → Memory (increase to 4GB+)
```

### Permission Issues (Linux)

```bash
# Run with sudo
sudo docker-compose up -d

# Or add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### Health Check Failures

```bash
# View health status
docker inspect swiftpay-backend | grep -A 8 'Health'

# Restart unhealthy container
docker-compose restart backend

# Temporarily disable health checks
# Edit docker-compose.yml and remove HEALTHCHECK lines
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database credentials secured
- [ ] JWT_SECRET is strong (32+ characters)
- [ ] Email credentials verified
- [ ] FRONTEND_URL set correctly
- [ ] SSL/TLS enabled (recommended)

### Production docker-compose.yml Modifications

```yaml
# Increase resource limits
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

  frontend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  mongodb:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Deployment Steps

1. **On Server:**
   ```bash
   # Clone repository
   git clone <repo> && cd SwiftPay
   
   # Create .env with production values
   nano .env
   
   # Start containers
   docker-compose up -d
   
   # Verify health
   docker-compose ps
   ```

2. **Enable HTTPS (Using Nginx/Traefik):**
   - Setup reverse proxy
   - Configure SSL certificates (Let's Encrypt)
   - Forward traffic to containers

3. **Monitoring:**
   ```bash
   # Monitor resource usage
   docker stats
   
   # Check logs regularly
   docker-compose logs --tail=50
   ```

4. **Backups:**
   ```bash
   # Backup MongoDB data
   docker-compose exec mongodb mongodump -u admin -p password --archive=/backup/db.archive
   
   # Copy from container
   docker cp swiftpay-mongodb:/backup/db.archive ./db.archive
   ```

---

## Advanced Configuration

### Using Environment-Specific Files

```bash
# Create multiple env files
.env.development
.env.staging
.env.production

# Use specific file (requires custom docker-compose override)
docker-compose --env-file .env.production up -d
```

### Custom Docker Networks

```bash
# Create custom network in docker-compose.yml
networks:
  swiftpay-network:
    driver: bridge
    name: swiftpay-prod-network
```

### Volume Persistence

```bash
# MongoDB data persists in docker volumes
docker volume ls

# Inspect volume
docker volume inspect swiftpay_mongodb_data

# Backup volumes
docker run --rm -v swiftpay_mongodb_data:/data -v $(pwd):/backup alpine tar czf /backup/mongo-backup.tar.gz /data
```

### Scaling Services

```bash
# Scale backend instances (requires load balancer setup)
docker-compose up -d --scale backend=3

# Note: Currently only one frontend recommended due to state management
```

### Container Registry Integration

```bash
# Tag images
docker tag swiftpay-backend:latest myregistry/swiftpay-backend:v1.0
docker tag swiftpay-frontend:latest myregistry/swiftpay-frontend:v1.0

# Push to registry
docker push myregistry/swiftpay-backend:v1.0
docker push myregistry/swiftpay-frontend:v1.0

# Update docker-compose.yml to use registry
# image: myregistry/swiftpay-backend:v1.0
```

### Multi-Stage Health Checks

Monitor all services:
```bash
# Create monitoring script
#!/bin/bash
while true; do
  echo "=== Service Status ==="
  docker-compose ps
  echo "=== Backend Health ==="
  curl -s http://localhost:8080/health || echo "Backend: Unhealthy"
  echo ""
  sleep 30
done
```

---

## Common Workflows

### Restart after Code Changes

```bash
# Backend changes
docker-compose up --build -d backend

# Frontend changes
docker-compose up --build -d frontend

# Both
docker-compose up --build -d
```

### Debug Container

```bash
# Access container shell
docker-compose exec backend /bin/sh

# Install debugging tools
apk add --no-cache curl wget nano

# Check environment
env

# Test connectivity
wget http://mongodb:27017
```

### Database Operations

```bash
# Connect to MongoDB
docker-compose exec mongodb mongosh -u admin -p password --authenticationDatabase admin

# Export data
docker-compose exec mongodb mongodump -u admin -p password -d SwiftPayDB -o /dump

# Import data
docker-compose exec mongodb mongorestore -u admin -p password /dump
```

### Performance Monitoring

```bash
# Real-time resource usage
docker stats

# Container inspection
docker inspect swiftpay-backend

# Network diagnostics
docker network inspect swiftpay_swiftpay-network
```

---

## Security Best Practices

1. **Use Strong Passwords**
   ```env
   MONGODB_PASSWORD=GenerateRandomSecurePassword32CharsMin
   JWT_SECRET=AnotherVeryLongRandomSecureString
   ```

2. **Environment Variables**
   - Never commit `.env` to git
   - Use `.env.example` for template
   - Rotate secrets regularly

3. **Image Security**
   - Use specific versions (not 'latest')
   - Scan images for vulnerabilities: `docker scan swiftpay-backend`
   - Use trusted base images

4. **Network Security**
   - Isolate services in custom networks
   - Use firewall rules
   - Disable unnecessary ports

5. **Production**
   - Use managed databases (MongoDB Atlas)
   - Enable SSL/TLS
   - Set up monitoring and logging
   - Regular backups

---

## Support & Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MongoDB Docker Hub](https://hub.docker.com/_/mongo)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
