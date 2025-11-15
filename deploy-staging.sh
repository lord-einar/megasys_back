#!/bin/bash

# Script para desplegar a Staging
# Uso: ./deploy-staging.sh

set -e

RESOURCE_GROUP="megasys-rg-62438"
APP_NAME="megasys-api"
SLOT="staging"
ZIP_FILE="backend-app.zip"

echo "=========================================="
echo "Deploying to Staging Environment"
echo "=========================================="

# Crear ZIP del backend
echo "1. Creating deployment package..."
rm -f "$ZIP_FILE"
zip -r "$ZIP_FILE" . \
  -x ".git/*" \
  "logs/*" \
  ".env.local" \
  ".claude/*" \
  "node_modules/*" \
  > /dev/null 2>&1

echo "✓ Package created: $ZIP_FILE"

# Desplegar a staging
echo ""
echo "2. Deploying to staging slot..."
az webapp deployment source config-zip \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --slot "$SLOT" \
  --src "$ZIP_FILE"

echo "✓ Deployment complete!"

# Configure slot-sticky settings for staging database
echo ""
echo "3. Configuring staging database settings..."
az webapp config appsettings set \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --slot "$SLOT" \
  --settings DB_NAME="megasys_staging" NODE_ENV="staging" \
  --slot-settings DB_NAME="megasys_staging" NODE_ENV="staging" \
  > /dev/null 2>&1

echo "✓ Staging database configuration applied"

# Información
echo ""
echo "=========================================="
echo "Staging Environment Ready"
echo "=========================================="
echo "URL: https://$APP_NAME-$SLOT.azurewebsites.net"
echo "Database: megasys_staging (isolated from production)"
echo ""
echo "Next steps:"
echo "1. Test the changes at the staging URL"
echo "2. Verify OAuth2 flow works"
echo "3. Check data isolation (queries should use megasys_staging)"
echo "4. Run: ./promote-to-production.sh"
echo ""

