FROM nginx:1.27-alpine

RUN mkdir -p /usr/share/nginx/html/assets /usr/share/nginx/html/content

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/index.html /usr/share/nginx/html/index.html
COPY frontend/page2.html /usr/share/nginx/html/page2.html
COPY frontend/content/ppv-context.txt /usr/share/nginx/html/content/ppv-context.txt
COPY frontend/content/ppv-rules.txt /usr/share/nginx/html/content/ppv-rules.txt
COPY frontend/assets/REGLEMENT-OFFICIEL-PPV-2026.pdf /usr/share/nginx/html/assets/REGLEMENT-OFFICIEL-PPV-2026.pdf

EXPOSE 80
