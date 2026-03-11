import actionPage from '../../integration/pageObjects/action';

const ActionPage = new actionPage();

describe('Тестовый файл', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it('Сравнение категорий из API и UI через intercept', () => {
        // 1. Перехватываем запрос (подставь свой URL)
        cy.intercept('GET', '/api/v3/promotions').as('promotions');

        cy.visit('/useful/shares/');

        ActionPage.check_action_title();
    });
})