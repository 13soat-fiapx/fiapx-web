FROM nginx:1.31.1-alpine-slim

COPY default.conf /etc/nginx/conf.d/default.conf

COPY generate-config.sh /generate-config.sh
RUN chmod +x /generate-config.sh

COPY src/* /usr/share/nginx/html/

EXPOSE 8080

ENTRYPOINT ["/generate-config.sh"]
CMD ["nginx", "-g", "daemon off;"]
