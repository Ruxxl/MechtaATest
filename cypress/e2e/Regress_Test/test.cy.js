import actionPage from '../../integration/pageObjects/action';

const ActionPage = new actionPage();

describe('Тестовый файл', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it('сравнение данных из перехваченного API с UI через expect', () => {
        // 1. Настраиваем перехват (до посещения страницы)
        // Укажи путь к твоему эндпоинту (можно использовать wildcard '*')
        cy.intercept('GET', '/api/v3/promotions').as('getPromotions');

        // 2. Заходим на страницу
        cy.visit('/useful/shares/');

        // 3. Ждем завершения запроса и работаем с его данными
        cy.wait('@getPromotions').then((interception) => {
            const apiData = interception.response.body.promotionTypes;

            // Проходим по каждому элементу, пришедшему из API
            apiData.forEach((promo) => {
                // Находим <a> по названию акции
                cy.contains('a[data-slot="base"]', promo.name)
                    .should('be.visible')
                    .find('span.text-mi-text-secondary')
                    .invoke('text')
                    .then((uiCountText) => {
                        const uiCount = parseInt(uiCountText.trim(), 10);

                        // Используем expect для проверки
                        expect(uiCount).to.equal(promo.count, `Количество для "${promo.name}" совпадает с API`);
                    });
            });
        });
    });
});