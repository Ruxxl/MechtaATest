import actionPage from '../../support/pageObjects/action';

const ActionPage = new actionPage();

describe('Страница Акции', () => {

    beforeEach(() => {
        cy.session('base-home', () => {

            cy.visit('/');
        });
    });

    it('Перейти на страницу Акции через главное меню', () => {

        ActionPage.interceptRequests();
        cy.visit('/')
        cy.contains('div', 'Акции').first().click();
        cy.url({
            timeout: 10000
        }).should('include', '/useful/shares/');
        ActionPage.checkRequests_after_visit();
    });

    it('Перейти на страницу Акции по прямой ссылке', () => {

        ActionPage.interceptRequests();
        cy.visit('/useful/shares/');
        ActionPage.checkRequests_after_visit();

    })

    it('Проверка отображения категории в акциях', () => {
        ActionPage.interceptRequests();
        cy.visit('/useful/shares/');
        ActionPage.check_category_in_action();

    })

    it('Проверка отображения типов акций', () => {
        ActionPage.interceptRequests();
        cy.visit('/useful/shares/');
        ActionPage.check_action_types();

    })

    it('Проверка отображения кол-во типов акций', () => {
        cy.intercept('GET', '/api/v3/promotions').as('promotions');
        cy.visit('/useful/shares/');
        cy.wait('@promotions').then((interception) => {

            const typesCount = interception.response.body.promotionTypes[0].count;

            // 4. Проверка в DOM
            cy.contains('a[data-slot="base"]', 'Все') // Находим ссылку, содержащую "Все"
                .find('span.text-mi-text-secondary') // Ищем внутри неё span с числом
                .should('be.visible')
                .and('have.text', typesCount.toString()); // Сверяем текст с числом из API
        })
    })

    it('Проверка сортировок акции', () => {

        ActionPage.interceptRequests();
        cy.visit('/useful/shares/');
        ActionPage.check_sorting();

    })

    it('Проверка отображения акций на странице', () => {

        ActionPage.interceptRequests();

        cy.visit('/useful/shares/');

        ActionPage.check_action_title();

    })

    it('Проверка отображения детальной акции', () => {

        ActionPage.interceptRequests();

        cy.visit('/useful/shares/');

        ActionPage.check_detail_action();
        
    })

    it('Проверка проверка перехода на страницу детальной акции по прямой ссылке', () => {

        cy.intercept('GET', '/api/v3/promotions').as('promotions');

        cy.visit('/useful/shares/');

        cy.wait('@promotions').then((interception) => {

            // 1. Берем слаг из ответа API
            const url_slug = interception.response.body.promotions[0].slug;

            // 2. Переходим по ссылке, используя косые кавычки (backticks)
            cy.visit(`/useful/shares/${url_slug}/`);

            // 3. Опционально: проверяем, что URL действительно изменился правильно
            cy.url({ timeout: 10000 }).should('include', url_slug);
        })

    })

    describe('Негативные кейсы', () => {

        it('Несуществующий слаг акции редиректит на список акций', () => {
            cy.fixture('testData').then((testData) => {
                // В отличие от товара (там 404), для несуществующей акции сайт
                // молча редиректит на общий список /useful/shares/, без ошибки
                cy.visit(testData.nonExistentPromoSlug, { failOnStatusCode: false });
                cy.url().should('eq', 'https://pp.yc.mechta.kz/useful/shares/');
            });
        });
    });

})