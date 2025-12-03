#!/bin/bash
# Script para deployar backend a PRODUCCIÓN
# Uso: ./deploy-production.sh

echo "==========================================="
echo "  DEPLOYMENT A PRODUCCIÓN - BACKEND"
echo "==========================================="
echo ""

RESOURCE_GROUP="megasys-rg-62438"
APP_NAME="megasys-api"

echo "⚠️  ADVERTENCIA: Estás por deployar a PRODUCCIÓN"
echo "Presiona CTRL+C para cancelar o ENTER para continuar..."
read

echo "📦 Creando archivo ZIP..."
zip -r deploy.zip . -x "*.git*" "logs/*" "node_modules/*" "*.zip"

echo "🚀 Deploying a Azure App Service (Producción)..."
az webapp deploy \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --src-path deploy.zip \
  --type zip

echo "🧹 Limpiando archivo temporal..."
rm deploy.zip

echo ""
echo "✅ Deployment completado!"
echo "🔗 URL: https://megasys-api.azurewebsites.net"
echo "🏥 Health: https://megasys-api.azurewebsites.net/health"
echo ""
echo "📊 Verifica los logs con:"
echo "   az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP"
