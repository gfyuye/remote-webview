FROM mcr.microsoft.com/playwright:v1.51.1-jammy

WORKDIR /app

USER root

COPY package*.json ./
RUN npm install --production

RUN useradd -m -u 1001 renderer && \
    mkdir -p /home/renderer/.cache/ms-playwright && \
    chown -R renderer:renderer /app /home/renderer

COPY --chown=renderer:renderer . .

USER renderer

EXPOSE 8050

CMD ["npm", "start"]
