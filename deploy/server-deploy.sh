#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/var/www/smart-study"
CURRENT_PATH="$BASE_DIR/current"
APP_DIR="${APP_DIR:-$CURRENT_PATH}"
REPO_URL="${REPO_URL:-https://github.com/shuitian666/study-app.git}"
BRANCH="${BRANCH:-main}"

sudo mkdir -p "$BASE_DIR"
sudo mkdir -p "$BASE_DIR/shared"
sudo mkdir -p "$BASE_DIR/releases"
sudo mkdir -p "$BASE_DIR/data"
sudo mkdir -p "$BASE_DIR/data/truth-images/originals"
sudo mkdir -p "$BASE_DIR/data/truth-images/thumbnails"
sudo mkdir -p "$BASE_DIR/data/truth-images/tmp"

sudo apt-get update
sudo apt-get install -y ca-certificates curl fonts-noto-cjk git nginx

if ! node -e "require('node:sqlite')" >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! node -e "require('node:sqlite')" >/dev/null 2>&1; then
  echo "Node.js 24+ with node:sqlite support is required. Current version: $(node -v 2>/dev/null || echo missing)" >&2
  exit 1
fi

if [ "${SKIP_GIT_SYNC:-}" = "1" ]; then
  echo "Using uploaded release bundle in $APP_DIR"
elif [ ! -d "$APP_DIR/.git" ]; then
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
if [ -f "$BASE_DIR/shared/server.env" ]; then
  sudo ln -sf "$BASE_DIR/shared/server.env" "$APP_DIR/server/.env"
fi
sudo chown -R www-data:www-data "$BASE_DIR/data"

sudo cp "$APP_DIR/deploy/nginx-smart-study.conf" /etc/nginx/sites-available/smart-study
sudo ln -sf /etc/nginx/sites-available/smart-study /etc/nginx/sites-enabled/smart-study
sudo rm -f /etc/nginx/sites-enabled/default

sudo cp "$APP_DIR/deploy/smart-study.service" /etc/systemd/system/smart-study.service
sudo systemctl daemon-reload
sudo systemctl enable smart-study

sudo nginx -t

previous_release=""
if [ "${ACTIVATE_RELEASE:-}" = "1" ] && [ "$APP_DIR" != "$CURRENT_PATH" ]; then
  if [ -L "$CURRENT_PATH" ]; then
    previous_release="$(readlink -f "$CURRENT_PATH" || true)"
  elif [ -d "$CURRENT_PATH" ]; then
    previous_release="$BASE_DIR/releases/legacy-$(date +%Y%m%d%H%M%S)"
    sudo mv "$CURRENT_PATH" "$previous_release"
  fi

  sudo ln -sfn "$APP_DIR" "$CURRENT_PATH.next"
  sudo mv -Tf "$CURRENT_PATH.next" "$CURRENT_PATH"
fi

rollback_release() {
  if [ -n "$previous_release" ] && [ -d "$previous_release" ]; then
    sudo ln -sfn "$previous_release" "$CURRENT_PATH.rollback"
    sudo mv -Tf "$CURRENT_PATH.rollback" "$CURRENT_PATH"
    sudo systemctl restart smart-study || true
  fi
}

if ! sudo systemctl restart smart-study; then
  rollback_release
  exit 1
fi

healthy=0
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3001/api/health >/dev/null; then
    healthy=1
    break
  fi
  sleep 1
done

if [ "$healthy" != "1" ]; then
  sudo journalctl -u smart-study --no-pager -n 80 || true
  rollback_release
  exit 1
fi

sudo systemctl reload nginx
echo "Deployed smart-study from $BRANCH"
