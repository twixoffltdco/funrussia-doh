# DoH deployment notes

- Host: `funrussia-doh.layero.dev`
- Endpoint: `/dns-query`
- Health endpoint previously reported: `{"ok":true,"game":"185.207.214.14","hijack":[],"dnsDiagnostics":true}`

Это ранее сообщённые значения, а не результат новой проверки в этом комплекте.

## Variables
- `HIJACK` — оставить пустой, пока нет подтверждённого списка доменов и целевых адресов.
- Upstream DNS — используй текущую проверенную настройку проекта.

Не включай DNS hijack для игровых/API-доменов только потому, что хочешь подключить кастомный сервер. Для подключения к IP-адресу DNS вообще не участвует.
