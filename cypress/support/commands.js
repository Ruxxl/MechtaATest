Cypress.Commands.add('login', () => {
    cy.request({
        method: 'POST',
        url: 'https://www.mechta.kz/api/v2/login', // Замените на URL вашего API
        body: {
            phone: '0000000000',
            sms_code: '0000',
        },
    }).then((response) => {
        expect(response.status).to.eq(200); // Убедитесь, что запрос успешен
    });
});

// Логин на тестовом стенде d2.im.mdev.kz — отдельный бэкенд (api.d.im.mdev.kz),
// не www.mechta.kz, поэтому cy.login() сюда не подходит (см. cabinetApi.js).
// Тем же тестовым номером/кодом 0000000000/0000 логинимся одним POST-запросом
// (подтверждено 2026-08-06: сервер сразу выставляет cookie-сессию, отдельный
// шаг "отправить код" для cy.request не нужен — он нужен только в реальном UI-флоу).
// Ответ содержит result:true, но при этом непустой errors: ["Код подтверждения устарел"] —
// это выглядит как несостыковка контракта самого API (успех + текст ошибки одновременно),
// но сессия при этом реально создаётся (последующие запросы аутентифицированы), поэтому
// для логина это не считаем блокером.
Cypress.Commands.add('loginD2', () => {
    cy.request({
        method: 'POST',
        url: 'http://api.d.im.mdev.kz/v2/login',
        headers: { Accept: 'application/json' },
        body: {
            phone: '0000000000',
            sms_code: '0000',
        },
    }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.result).to.eq(true);
    });
});

// Логин на тестовом стенде d5.im.mdev.kz — отдельный бэкенд (api.d5.im.mdev.kz),
// новый эквайринг (test-epay.epayment.kz) подключён только здесь. Тот же паттерн,
// что и у loginD2 (см. комментарий там про result:true + непустой errors —
// та же несостыковка контракта воспроизводится и тут, сессия всё равно создаётся).
Cypress.Commands.add('loginD5', () => {
    cy.request({
        method: 'POST',
        url: 'http://api.d5.im.mdev.kz/v2/login',
        headers: { Accept: 'application/json' },
        body: {
            phone: '0000000000',
            sms_code: '0000',
        },
    }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.result).to.eq(true);
    });
});

// Логин на тестовом стенде pp.im.mdev.kz — отдельный бэкенд (api.pp.im.mdev.kz),
// та же схема, что и у loginD2/loginD5 (см. комментарий там). ВАЖНО: стенд
// отвечает только по http, https даёт ERR_CONNECTION_REFUSED (см. memory
// reference_pp_im_stand) — поэтому url тоже http, а не https.
Cypress.Commands.add('loginPpIm', () => {
    cy.request({
        method: 'POST',
        url: 'http://api.pp.im.mdev.kz/v2/login',
        headers: { Accept: 'application/json' },
        body: {
            phone: '0000000000',
            sms_code: '0000',
        },
    }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.result).to.eq(true);
    });
});

// После добавления товара в корзину сайт иногда показывает модалку апсела
// сопутствующих аксессуаров ("Выберите зарядное устройство" и т.п.).
// Закрываем её кнопкой "Продолжить", если она появилась, иначе ничего не делаем.
Cypress.Commands.add('dismissAccessoryUpsell', () => {
    cy.get('body').then(($body) => {
        const continueBtn = $body.find('button:contains("Продолжить")');

        if (continueBtn.length > 0 && continueBtn.is(':visible')) {
            cy.wrap(continueBtn).first().click();
        }
    });
});

// На страницах товара иногда сама выскакивает промо-модалка (например,
// подписка на уведомления) с тёмным оверлеем, перекрывающим кнопки
// "В корзину"/"Купить сейчас". Закрываем её по Esc, если она есть.
Cypress.Commands.add('dismissPromoModal', () => {
    cy.get('body').then(($body) => {
        const overlay = $body.find('[data-slot="overlay"]');

        if (overlay.length > 0 && overlay.is(':visible')) {
            cy.get('body').type('{esc}');
        }
    });
});

// На стенде d2.im.mdev.kz (в т.ч. на страницах раздела ЛК) иногда
// самостоятельно всплывает попап подтверждения города ("Ваш город
// Астана? Все верно / Сменить город"), перекрывающий верхнюю часть
// страницы (заголовок и т.п.) — по указанию пользователя всегда жмём
// "Все верно", если попап появился, иначе ничего не делаем.
//
// ВАЖНО (найдено 2026-08-07): попап всплывает АСИНХРОННО, иногда через
// 1-2с ПОСЛЕ того, как cy.visit() уже разрешился и статичная разметка
// отрисована (см. reviews.cy.js run3 — скриншот падения теста поймал
// попап появившимся, хотя dismissCityConfirmPopup() уже отработал сразу
// после visit и ничего не нашёл). Поэтому здесь не одна проверка, а
// короткий retry-цикл (~1.8с окно), чтобы поймать попап, даже если он
// ещё не успел отрендериться в момент первого вызова.
Cypress.Commands.add('dismissCityConfirmPopup', () => {
    const tryDismiss = (attemptsLeft) => {
        cy.get('body').then(($body) => {
            const confirmBtn = $body.find('button:contains("Все верно")');

            if (confirmBtn.length > 0 && confirmBtn.is(':visible')) {
                cy.wrap(confirmBtn).first().click();
            } else if (attemptsLeft > 0) {
                cy.wait(300);
                tryDismiss(attemptsLeft - 1);
            }
        });
    };
    tryDismiss(6);
});