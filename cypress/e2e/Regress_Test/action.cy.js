import actionPage from '../../integration/pageObjects/action';

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
        cy.contains('div', 'Акции', {
            timeout: 10000
        }).first().click();
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
})