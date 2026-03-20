import checkout from "../../integration/pageObjects/checkout";
import add_basket from "../../integration/pageObjects/add_basket";
import productPage from "../../integration/pageObjects/product_page";

const ProductPage = new productPage()

const Add_basket = new add_basket();

const Checkout = new checkout();

describe('Тестовый файл', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
            cy.login()
        });
    });

    it('Тестовый сценарии', () => {

        cy.login()

        cy.intercept('GET', '/api/v3/product/*/subdivisions').as('subdivisions')

        // 1. Visit the page
        cy.visit('/product/smartfon-oppo-reno-14-5g-12512gb-opal-white/');

        cy.get('#product-shops').click()

        cy.wait('@subdivisions').then((interception) => {
            expect(interception.response.statusCode).to.equal(200);

            const responseData = interception.response.body;

            // 1. Фильтруем объекты
            const shopwindowItems = responseData.filter(item => item.stock === "На витрине");

            // 2. Извлекаем только адреса в отдельный массив
            const shopAddresses = shopwindowItems.map(item => item.address);

            // 3. Выводим результат для проверки в консоль Cypress
            cy.log('Адреса магазинов с витриной:', shopAddresses);

            // Если адресов нет, можно добавить проверку, чтобы тест не шел дальше вхолостую
            expect(shopAddresses).to.have.length.greaterThan(0);

            // Теперь массив shopAddresses доступен для дальнейших действий
            // Например, можно сохранить его в alias, чтобы использовать ВНЕ этого блока .then()
            cy.wrap(shopAddresses).as('targetAddresses');
        });

        // Пример использования сохраненных адресов позже в тесте:
        cy.get('@targetAddresses').then((addresses) => {
            addresses.forEach((addr) => {
                cy.contains(addr).should('be.visible');
            });
        });


    })

})