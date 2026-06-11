# Aliyun deployment

Target server:

- Public IP: `47.95.1.189`
- App root: `/var/www/smart-study/current`
- Persistent env: `/var/www/smart-study/shared/server.env`
- Node service: `smart-study`

## 1. Prepare the server once

```bash
sudo apt update
sudo apt install -y git nginx nodejs npm
sudo mkdir -p /var/www/smart-study/shared
sudo chown -R www-data:www-data /var/www/smart-study
```

Create `/var/www/smart-study/shared/server.env` on the server:

```env
NODE_ENV=production
PORT=3001
CORS_ORIGINS=http://47.95.1.189
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
AI_CONFIG_ENCRYPTION_KEY=
SESSION_COOKIE_NAME=study_session
DATA_DIR=/var/www/smart-study/data
TRUTH_MODE_ENABLED=true
TRUTH_ADMIN_EMAILS=3546064605@qq.com
TRUTH_PDF_FONT_PATH=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
MAIL_FROM=智学助手 <your-email@qq.com>
```

Truth-mode images are stored outside the Git checkout:

```text
/var/www/smart-study/data/truth-images/originals
/var/www/smart-study/data/truth-images/thumbnails
```

They survive deployments because `/var/www/smart-study/current` is the only directory
replaced by Git. Configure an ECS snapshot policy for `/var/www/smart-study/data`.

## 2. First manual deploy

```bash
sudo git clone --branch main https://github.com/shuitian666/study-app.git /var/www/smart-study/current
cd /var/www/smart-study/current
sudo bash deploy/server-deploy.sh
```

Verify:

```bash
curl http://127.0.0.1:3001/api/health
curl http://47.95.1.189/api/health
sudo systemctl status smart-study --no-pager
```

## 3. GitHub auto deploy

Add these GitHub repository secrets:

- `ALIYUN_HOST`: `47.95.1.189`
- `ALIYUN_USER`: SSH user, usually `root`
- `ALIYUN_PORT`: `22`
- `ALIYUN_SSH_KEY`: private key allowed to SSH into the server

After that, every push to `main` runs `.github/workflows/deploy-aliyun.yml`, pulls the latest code on the server, builds, and restarts `smart-study`.
