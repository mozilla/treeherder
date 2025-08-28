#!/bin/bash

# Docker Native Backup Script for Treeherder
# Creates a comprehensive backup of all Docker data

set -e

BACKUP_DIR="treeherder_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "Starting Treeherder Docker backup to $BACKUP_DIR..."

# 1. Export PostgreSQL database
echo "Backing up PostgreSQL database..."
docker exec postgres pg_dumpall -U postgres > "$BACKUP_DIR/postgres_backup.sql"

# 2. Export Redis data (if persistent)
echo "Backing up Redis data..."
docker exec redis redis-cli --rdb /tmp/redis_backup.rdb BGSAVE
sleep 2  # Give Redis time to complete the save
docker cp redis:/data/dump.rdb "$BACKUP_DIR/redis_backup.rdb" 2>/dev/null || \
  docker cp redis:/tmp/redis_backup.rdb "$BACKUP_DIR/redis_backup.rdb" 2>/dev/null || \
  echo "Warning: Redis backup might not be persistent"

# 3. Export RabbitMQ definitions (queues, exchanges, bindings)
echo "Backing up RabbitMQ definitions..."
docker exec rabbitmq rabbitmqctl export_definitions /tmp/rabbitmq_backup.json 2>/dev/null || \
  echo "Warning: RabbitMQ definitions export not available (might need management plugin)"
docker cp rabbitmq:/tmp/rabbitmq_backup.json "$BACKUP_DIR/rabbitmq_backup.json" 2>/dev/null || true

# 4. Backup Docker volumes
echo "Backing up Docker volumes..."
# Get the postgres volume name (usually treeherder_postgres_data)
POSTGRES_VOLUME=$(docker volume ls --filter "name=postgres_data" --format "{{.Name}}" | head -1)
if [ -n "$POSTGRES_VOLUME" ]; then
    echo "Found PostgreSQL volume: $POSTGRES_VOLUME"
    # Create a tarball of the volume using a temporary container
    docker run --rm -v "$POSTGRES_VOLUME":/volume -v "$(pwd)/$BACKUP_DIR":/backup alpine \
        tar czf /backup/postgres_volume.tar.gz -C /volume .
fi

# 5. Save Docker images (optional - comment out if images can be rebuilt)
echo "Saving Docker images..."
docker save treeherder-backend -o "$BACKUP_DIR/treeherder-backend.tar" 2>/dev/null || \
  echo "Warning: Could not save treeherder-backend image"

# 6. Copy docker-compose and environment files
echo "Copying Docker configuration files..."
cp docker-compose.yml "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/" 2>/dev/null || echo "No .env file found"
cp docker/dev.Dockerfile "$BACKUP_DIR/dev.Dockerfile" 2>/dev/null || true
cp -r docker "$BACKUP_DIR/" 2>/dev/null || true

# 7. Create restore script
cat > "$BACKUP_DIR/restore.sh" << 'EOF'
#!/bin/bash

# Docker Native Restore Script for Treeherder

set -e

echo "Starting Treeherder Docker restore..."

# 1. Load Docker images (if saved)
if [ -f "treeherder-backend.tar" ]; then
    echo "Loading Docker images..."
    docker load -i treeherder-backend.tar
fi

# 2. Start only the database services first
echo "Starting database services..."
docker-compose up -d postgres redis rabbitmq

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker exec postgres pg_isready -U postgres; do
    sleep 2
done

# 3. Restore PostgreSQL database
echo "Restoring PostgreSQL database..."
docker exec -i postgres psql -U postgres < postgres_backup.sql

# 4. Restore Redis data (if exists)
if [ -f "redis_backup.rdb" ]; then
    echo "Restoring Redis data..."
    docker cp redis_backup.rdb redis:/data/dump.rdb
    docker restart redis
fi

# 5. Restore RabbitMQ definitions (if exists)
if [ -f "rabbitmq_backup.json" ]; then
    echo "Restoring RabbitMQ definitions..."
    docker cp rabbitmq_backup.json rabbitmq:/tmp/
    docker exec rabbitmq rabbitmqctl import_definitions /tmp/rabbitmq_backup.json 2>/dev/null || \
        echo "Warning: Could not import RabbitMQ definitions"
fi

# 6. Alternative: Restore PostgreSQL volume directly (if needed)
# Uncomment if you prefer volume restoration over SQL restore
# if [ -f "postgres_volume.tar.gz" ]; then
#     echo "Restoring PostgreSQL volume..."
#     POSTGRES_VOLUME=$(docker volume ls --filter "name=postgres_data" --format "{{.Name}}" | head -1)
#     docker run --rm -v "$POSTGRES_VOLUME":/volume -v "$(pwd)":/backup alpine \
#         sh -c "rm -rf /volume/* && tar xzf /backup/postgres_volume.tar.gz -C /volume"
# fi

# 7. Start all services
echo "Starting all services..."
docker-compose up -d

echo "Restore complete! Services should be running."
echo "Run 'docker-compose ps' to check status."
EOF

chmod +x "$BACKUP_DIR/restore.sh"

# Create a tarball of everything
echo "Creating final backup archive..."
tar czf "${BACKUP_DIR}.tar.gz" "$BACKUP_DIR"

echo "✅ Backup complete!"
echo "Backup saved to: ${BACKUP_DIR}.tar.gz"
echo ""
echo "To restore on another machine:"
echo "1. Copy ${BACKUP_DIR}.tar.gz to the new machine"
echo "2. Extract: tar xzf ${BACKUP_DIR}.tar.gz"
echo "3. cd ${BACKUP_DIR}"
echo "4. Run: ./restore.sh"