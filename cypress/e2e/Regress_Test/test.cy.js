import Home_page from '../../integration/pageObjects/home_page';

const home_page = new Home_page();

describe('Тестовый файл', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
            cy.login()
        });
    });

    it('Тестовый сценарии', () => {

        home_page.interceptRequests() // перехватываем запросы ДО visit

        cy.visit('/')

        home_page.checkPopularCategories()

    })

})