FROM redocly/cli:latest AS gen-openapi
WORKDIR /work
COPY contracts/openapi.yaml .
RUN redocly build-docs openapi.yaml -o /out/index.html

FROM asyncapi/cli:latest AS gen-asyncapi
WORKDIR /work
COPY contracts/asyncapi.yaml .
ENV SUPPRESS_NO_CONFIG_WARNING=true
RUN asyncapi generate fromTemplate asyncapi.yaml @asyncapi/html-template --output ./out

FROM nginx:1.31.1-alpine-slim

COPY default.conf                /etc/nginx/conf.d/default.conf
COPY --chmod=755 generate-config.sh /generate-config.sh

COPY --from=gen-openapi  /out/      /usr/share/nginx/html/contracts/openapi/
COPY --from=gen-asyncapi /work/out/ /usr/share/nginx/html/contracts/asyncapi/

COPY web/ /usr/share/nginx/html/

EXPOSE 8080

ENTRYPOINT ["/generate-config.sh"]
CMD ["nginx", "-g", "daemon off;"]
