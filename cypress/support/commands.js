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