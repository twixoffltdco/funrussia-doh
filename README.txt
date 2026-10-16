FUN RUSSIA DNS-over-HTTPS (Layero light)
========================================
Домен: https://funrussia.layero.dev
Endpoint: https://funrussia.layero.dev/dns-query

Деплой на Layero как Node-приложение:
  - root = папка doh-server
  - start: npm start
  - порт: из $PORT (Layero сам)

После деплоя проверь:
  curl -s "https://funrussia.layero.dev/health"
  curl -s "https://funrussia.layero.dev/dns-query?name=api.blackrussia.online"

iOS: ставь профиль ios/funrussia.mobileconfig
(он указывает DNS HTTPS на https://funrussia.layero.dev/dns-query)

UDP 53 НЕ нужен — всё по HTTPS 443.
