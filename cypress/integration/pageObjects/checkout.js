class checkout {

    auth_checkout() {

        cy.contains('p', 'Войти', {
                timeout: 20000
            })
            .first()
            .should('be.visible')
            .click();

        cy.get('#v-0-3', {
                timeout: 20000
            })
            .type('0000000000');

        cy.contains('button', 'Выслать код', {
                timeout: 20000
            })
            .first()
            .should('be.visible')
            .click();

        cy.wait(5000);

        cy.intercept('GET', '/api/v2/user').as('User');

        cy.get('input[aria-label="pin input 1 of 4"]', {
                timeout: 20000
            })
            .should('be.visible')
            .type('0000');


        cy.wait(10000)
        
        cy.wait('@user',).then((interception) => {

            expect(interception.response.statusCode).to.equal(200);
            const user_phone = interception.response.body.data.phone;
            const user_name = interception.response.body.data.full_name;

            expect(user_phone).to.equal('0000000000');
            expect(user_name).to.equal('John Appleseed');
        });

        cy.contains('div', 'Авторизация прошла успешно', {
            timeout: 20000
        }).first().should('be.visible');

    }

    request_intercept() {

        cy.intercept('GET', '/api/v3/personal/delivery-addresses').as('delivery_addresses');
        cy.intercept('GET', '/api/v2/personal/card').as('card');
        cy.intercept('GET', '/api/v2/checkout?**').as('get_checkout');

    }

    step_one() {

        cy.wait('@get_checkout').then((interception) => {


        })

    }

}

export default checkout;