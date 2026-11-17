/* Настройки Firebase.
   Пока здесь стоят заглушки, сайт работает в ДЕМО-режиме: все данные лежат только
   в браузере. Чтобы включить настоящие аккаунты, общие доски и хранение в облаке,
   пройдите шаги из SETUP.md и вставьте сюда свой конфиг.
   Эти значения не секретные: данные защищают правила из database.rules.json. */
window.MEAW_FIREBASE = {
  apiKey: 'PASTE_API_KEY',
  authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
  databaseURL: 'https://PASTE_PROJECT_ID-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'PASTE_PROJECT_ID',
  appId: 'PASTE_APP_ID'
};

/* Какие способы входа показывать (включите их и в консоли Firebase). */
window.MEAW_PROVIDERS = { google: true, github: false };
