FROM nginx:1.31.1-alpine

COPY src/* /usr/share/nginx/html/
COPY default.conf /etc/nginx/conf.d/default.conf

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
