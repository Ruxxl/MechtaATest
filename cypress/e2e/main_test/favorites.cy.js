import favorites from "../../support/pageObjects/favorites";

const Favorites = new favorites();

describe('Избранное', () => {

    it('Анонимный пользователь: пустое состояние избранного', () => {
        cy.visit('/favorites/');
        cy.url().should('include', 'pp.yc.mechta.kz');
        // Список избранного анонимного пользователя не редиректит на логин —
        // просто показывает собственное пустое состояние
        Favorites.assertAnonymousEmptyState();
    });

    it('Авторизованный пользователь: список избранного отображается', () => {
        cy.login();
        cy.visit('/favorites/');
        Favorites.assertAuthenticatedListVisible();
    });
});
