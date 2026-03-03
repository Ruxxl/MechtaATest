class productPage {
  interceptRequests() {
        cy.intercept('GET', '**/api/v3/product/**/alternatives').as('alternatives');
        cy.intercept('GET', '**/api/v2/header/info').as('header_info');
        cy.intercept('GET', '**/api/v2/header/cities').as('header_cities');
        cy.intercept('GET', '**/api/v2/basket').as('get_basket');
        cy.intercept('GET', '**/api/v2/user').as('user');
        cy.intercept('GET', '**/api/v2/favorites').as('favorites');
        cy.intercept('GET', '**/api/v3/catalog/menu').as('catalog_menu');
        cy.intercept('POST', '**/api/v2/mindbox/actions/catalog').as('actions_catalog');
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.intercept('GET', '**/api/v3/catalog/offers?**').as('offers');
        cy.intercept('GET', '**/api/v3/product/*/reviews?**').as('reviews');
        cy.intercept('GET', '**/api/v3/product/*/properties').as('properties');
        cy.intercept('GET', '**/api/v3/product/*/shipment').as('shipment');
        cy.intercept('GET', '**/api/v3/product/*/description').as('description');
        cy.intercept('GET', '**/api/v3/product/*/similar').as('similar');
        cy.intercept('GET', '**/api/v3/product/*/subdivisions').as('subdivisions');
        cy.intercept('GET', '**/api/v3/trade-in/instruction').as('trede_in_instruction');
        cy.intercept('GET', '**/api/v3/catalog/meta?**').as('catalog_meta');
        cy.intercept('GET', '**/api/v3/product/*/offers').as('product_offers');
        cy.intercept('GET', '**/api/v2/compare/small').as('compare_small');
        cy.intercept('POST', '**/api/v3/personal/view/product').as('view_product');
        cy.intercept('POST', '**/api/seo-resolve').as('seo_resolve');
    }

    wait_requests() {
        const requests = [
            '@alternatives',
            '@header_info',
            '@header_cities',
            '@get_basket',
            '@favorites',
            '@catalog_menu',
            '@product',
            '@offers',
            '@reviews',
            '@properties',
            '@shipment',
            '@description',
            '@similar',
            '@subdivisions',
            '@trede_in_instruction',
            '@catalog_meta',
            '@compare_small',
            '@view_product',
            '@seo_resolve',
        ];

        requests.forEach(alias => {
            cy.wait(alias, { timeout: 20000 }).its('response.statusCode').should('be.oneOf', [200, 204]);
        });

        // user — отдельная проверка
        cy.wait('@user')
        .its('response.statusCode')
        .should('be.oneOf', [200, 401]);
    }

}

export default productPage;