#!/bin/bash
echo "Запускаем ngrok..."
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys,json
try:
  data=json.load(sys.stdin)
  print(data['tunnels'][0]['public_url'])
except:
  print('')
")

if [ -z "$NGROK_URL" ]; then
  echo "ngrok не запущен. Запусти: ngrok http 3000"
  echo "Используем localhost..."
  FRONTEND_URL=http://localhost:3000
else
  echo "ngrok URL: $NGROK_URL"
  FRONTEND_URL=$NGROK_URL
fi

# Обновляем FRONTEND_URL в .env
sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=$FRONTEND_URL|" .env

echo "FRONTEND_URL установлен: $FRONTEND_URL"
echo "Пересобираем backend..."
docker compose -f docker-compose.dev.yml up -d --force-recreate backend
