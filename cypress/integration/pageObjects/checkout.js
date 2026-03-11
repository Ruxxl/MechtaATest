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

        cy.intercept('GET', '/api/v2/user').as('User');
        
        cy.get('input[aria-label="pin input 1 of 4"]', {
                timeout: 20000
            })
            .should('be.visible')
            .type('0000');
            

        cy.wait('@User').then((interception) => {

            expect(interception.response.statusCode).to.equal(200);
        });

        cy.contains('div', 'Авторизация прошла успешно', {
            timeout: 20000
        }).first().should('be.visible');

    }

    

}

export default checkout;