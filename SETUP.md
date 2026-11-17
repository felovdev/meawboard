# Подключение Firebase (бесплатно) для meaw board

Без этого сайт работает в демо-режиме (данные только в вашем браузере).

1. https://console.firebase.google.com → **Добавить проект** (Google Analytics не нужен).
2. **Build → Authentication → Начать** → включите **Email/Password**, **Google** и **Anonymous** (гостевой вход).
   В **Settings → Authorized domains** добавьте `felovdev.github.io`.
3. **Build → Realtime Database → Создать базу** (режим «заблокированный»). Вкладка **Правила** → вставьте содержимое `database.rules.json` → **Опубликовать**.
4. **Project settings → Your apps → Web (`</>`)** → зарегистрируйте приложение → скопируйте `firebaseConfig`.
5. Вставьте значения в `firebase-config.js` (apiKey, authDomain, databaseURL, projectId, appId) и закоммитьте.
6. GitHub: **Settings → Pages → Deploy from branch → main / root**. Сайт: https://felovdev.github.io/meawboard/

Ссылки-приглашения выглядят как `https://felovdev.github.io/meawboard/<случайный_код>` (работают через 404.html).
Картинки хранятся в Realtime Database (сжимаются до ~650 КБ), т.к. Firebase Storage требует платный тариф.
