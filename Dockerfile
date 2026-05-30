FROM nginx:1.31.1-alpine-slim

COPY default.conf /etc/nginx/conf.d/default.conf

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY src/* /usr/share/nginx/html/

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
