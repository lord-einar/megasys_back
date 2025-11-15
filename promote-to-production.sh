#!/bin/bash

# Script para promover Staging a Producción
# Uso: ./promote-to-production.sh

set -e

RESOURCE_GROUP="megasys-rg-62438"
APP_NAME="megasys-api"
SLOT="staging"

echo "=========================================="
echo "PROMOTING STAGING TO PRODUCTION"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will swap staging with production"
echo ""
echo "Production URL:  https://$APP_NAME.azurewebsites.net"
echo "Staging URL:     https://$APP_NAME-$SLOT.azurewebsites.net"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Cancelled"
  exit 1
fi

echo ""
echo "Performing swap..."
az webapp deployment slot swap \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --slot "$SLOT"

echo ""
echo "✓ Swap complete!"
echo ""
echo "=========================================="
echo "Production Updated"
echo "=========================================="
echo "URL: https://$APP_NAME.azurewebsites.net"
echo ""
echo "Changes are now LIVE in production"
echo ""
echo "In case of issues, run rollback:"
echo "  ./rollback.sh"
echo ""

