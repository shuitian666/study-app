#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/smart-study/current"
REPO_URL="${REPO_URL:-https://github.com/shuitian666/study-app.git}"
BRANCH="${BRANCH:-main}"

sudo mkdir -p /var/www/smart-study
sudo mkdir -p /var/www/smart-study/shared
sudo mkdir -p /var/www/smart-study/data

if ! node -e "require('node:sqlite')" >/dev/null 2>&1; then
  echo "Node.js 24+ with node:sqlite support is required. Current version: $(node -v 2>/dev/null || echo missing)" >&2
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  sudo rm -rf "$APP_DIR"
  sudo git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  sudo git fetch origin "$BRANCH"
  sudo git reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"
sudo npm ci
sudo npm run build

cd "$APP_DIR/server"
sudo npm ci --omit=dev
if [ -f /var/www/smart-study/shared/server.env ]; then
  sudo ln -sf /var/www/smart-study/shared/server.env "$APP_DIR/server/.env"
fi

sudo cp "$APP_DIR/deploy/nginx-smart-study.conf" /etc/nginx/sites-available/smart-study
sudo ln -sf /etc/nginx/sites-available/smart-study /etc/nginx/sites-enabled/smart-study
sudo rm -f /etc/nginx/sites-enabled/default

sudo cp "$APP_DIR/deploy/smart-study.service" /etc/systemd/system/smart-study.service
sudo systemctl daemon-reload
sudo systemctl enable smart-study
sudo systemctl restart smart-study

sudo nginx -t
sudo systemctl reload nginx

sudo chown -R www-data:www-data /var/www/smart-study/data
echo "Deployed smart-study from $BRANCH"
