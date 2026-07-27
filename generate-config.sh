#!/bin/sh

OUTPUT="${CONFIG_OUTPUT:-/usr/share/nginx/html/config.js}"

cat > "$OUTPUT" << EOF
window.__AUTH0_DOMAIN__    = '${DOMAIN}';
window.__AUTH0_CLIENT_ID__ = '${CLIENT_ID}';
window.__AUTH0_AUDIENCE__  = '${AUDIENCE}';
window.__API_BASE__        = '${API_BASE}';
window.__MAX_VIDEO_DURATION_SECONDS__ = '${MAX_VIDEO_DURATION_SECONDS:-600}';
window.__MAX_FILE_SIZE_BYTES__        = '${MAX_FILE_SIZE_BYTES:-314572800}';
EOF

if [ "$#" -gt 0 ]; then
    exec "$@"
fi
