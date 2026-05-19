#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec infra-postgres pg_dump -U admin infra_db > "$BACKUP_DIR/backup_$DATE.sql"
