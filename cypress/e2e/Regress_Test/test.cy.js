import actionPage from '../../integration/pageObjects/action';
import add_basket from '../../integration/pageObjects/add_basket';
import checkout from "../../integration/pageObjects/checkout";

const ActionPage = new actionPage();
const Add_basket = new add_basket();
const Checkout = new checkout();

describe('Тестовый файл', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it('Сравнение категорий из API и UI через intercept', () => {

        Checkout.request_intercept()

        cy.login()

        cy.visit('/product/smart-chasy-apple-watch-se-gps-40mm-midnight-aluminium-case-with-ink-sport-loop-mxea3qia/')

        cy.contains('button', 'Купить сейчас', {timeout: 20000}).first()
            .click()
 

        Checkout.step_one()
        

        Checkout.step_two()

    });
})
