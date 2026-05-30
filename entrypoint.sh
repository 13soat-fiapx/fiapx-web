#!/bin/sh

cat > /usr/share/nginx/html/config.js << EOF
window.__AUTH0_DOMAIN__    = '${DOMAIN}';
window.__AUTH0_CLIENT_ID__ = '${CLIENT_ID}';
window.__AUTH0_AUDIENCE__  = '${AUDIENCE}';
window.__API_BASE__        = '${API_BASE}';
EOF

exec nginx -g 'daemon off;'
