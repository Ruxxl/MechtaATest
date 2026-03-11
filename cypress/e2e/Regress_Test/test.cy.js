import actionPage from '../../integration/pageObjects/action';

const ActionPage = new actionPage();

describe('Тестовый файл', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it('должен содержать кнопку с текстом "новые" внутри w-full блока', () => {
        cy.visit('/useful/shares/');
        
    });
});