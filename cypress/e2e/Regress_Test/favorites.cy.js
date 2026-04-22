import favorites from "../../integration/pageObjects/favorites";    

const Favorites = new favorites();

describe('Главная страница', () => {

    beforeEach(() => {

        Favorites.interceptRequests()
        
    });

    it('Проверка базового состояния и API запросов', () => { // перехватываем запросы ДО visit
        cy.url().should('include', 'pp.yc.mechta.kz');
        
        
    });
});