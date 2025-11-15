#!/bin/bash

# Script para hacer rollback de Producción a Staging (versión anterior)
# Uso: ./rollback.sh

set -e

RESOURCE_GROUP="megasys-rg-62438"
APP_NAME="megasys-api"
SLOT="staging"

echo "=========================================="
echo "EMERGENCY ROLLBACK"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will swap production with staging"
echo "    Production will revert to previous version"
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
echo "Performing rollback swap..."
az webapp deployment slot swap \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --slot "$SLOT"

echo ""
echo "✓ Rollback complete!"
echo ""
echo "=========================================="
echo "Production Rolled Back"
echo "=========================================="
echo "Previous version is now LIVE"
echo "Current broken version is in staging"
echo ""
echo "Next steps:"
echo "1. Verify production is working: https://$APP_NAME.azurewebsites.net"
echo "2. Fix the issue in your code"
echo "3. Deploy again: ./deploy-staging.sh"
echo ""

