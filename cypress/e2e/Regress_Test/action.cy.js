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
        cy.contains('div', 'Акции', {timeout: 10000}).first().click();
        cy.url({
            timeout: 10000
        }).should('include', '/useful/shares/');
        cy.get('img[alt="action-slogan"]', {
            timeout: 10000
        }).should('be.visible');
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
})