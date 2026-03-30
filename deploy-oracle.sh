#!/bin/bash
# Signal CRM — Oracle Cloud Deploy Script
# Run this on your Oracle Cloud Ubuntu VM
# Usage: bash deploy-oracle.sh

set -e

echo "=== Signal CRM — Oracle Cloud Deployment ==="
echo ""

# Prompt for Supabase credentials
read -p "Enter SUPABASE_URL (e.g. https://xxxx.supabase.co): " SUPABASE_URL
read -p "Enter SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
read -p "Enter SUPABASE_SERVICE_KEY: " SUPABASE_SERVICE_KEY
read -p "Enter frontend URL for CORS (e.g. https://signal-crm.pages.dev): " FRONTEND_URL

echo ""
echo "=== Installing dependencies ==="
sudo apt-get update -qq
sudo apt-get install -y -qq docker.io docker-compose git curl nginx certbot python3-certbot-nginx

# Enable Docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

echo ""
echo "=== Cloning repository ==="
if [ -d "/opt/signal-crm" ]; then
  cd /opt/signal-crm && sudo git pull origin main
else
  sudo git clone https://github.com/vishmatale-nanoneuron/signal-crm.git /opt/signal-crm
fi

echo ""
echo "=== Creating .env file ==="
sudo tee /opt/signal-crm/backend/.env > /dev/null << EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
RAZORPAY_KEY_ID=rzp_test_SXSbotImCIeKSM
RAZORPAY_KEY_SECRET=K7mIRyHhIqL2eDCTrcLjP2i5
CORS_ORIGINS=["http://localhost:3000","${FRONTEND_URL}"]
EXTRA_CORS_ORIGINS=${FRONTEND_URL}
BANK_ACCOUNT_NUMBER=922020067340454
BANK_ACCOUNT_HOLDER=Nanoneuron Services
BANK_IFSC=UTIB0005124
PORT=8000
EOF

echo ""
echo "=== Building and starting Docker container ==="
cd /opt/signal-crm/backend
sudo docker-compose down 2>/dev/null || true
sudo docker-compose build --no-cache
sudo docker-compose up -d

echo ""
echo "=== Waiting for service to start (20s) ==="
sleep 20

echo ""
echo "=== Health check ==="
curl -s http://localhost:8000/api/health && echo ""

echo ""
echo "=== Setting up Nginx reverse proxy ==="
SERVER_IP=$(curl -s ifconfig.me)

sudo tee /etc/nginx/sites-available/signal-crm > /dev/null << 'NGINXCONF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }
}
NGINXCONF

sudo ln -sf /etc/nginx/sites-available/signal-crm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "============================================"
echo "DEPLOYMENT COMPLETE!"
echo "============================================"
echo "Backend URL: http://${SERVER_IP}"
echo "Health check: http://${SERVER_IP}/api/health"
echo "API Docs: http://${SERVER_IP}/docs"
echo ""
echo "NEXT STEPS:"
echo "1. Open Oracle Cloud firewall port 80:"
echo "   OCI Console > Networking > VCN > Security List > Add Ingress Rule: Port 80"
echo "2. Update frontend NEXT_PUBLIC_API_URL to: http://${SERVER_IP}"
echo "3. (Optional) Point domain and run: sudo certbot --nginx -d yourdomain.com"
echo "============================================"
