class HomePage {
    constructor() {
        // Сюда можно сохранять алиасы, если нужно
        this.aliases = [
            'seoResolve', 'headerInfo', 'headerCities', 'basket', 'favorites', 'user',
            'catalogMenu', 'popularTop', 'popularCategories', 'banners', 'recommendations',
            'history', 'catalogOffers', 'catalogMeta', 'compareSmall'
        ]
    }

    // Метод для перехвата всех ключевых API
    interceptRequests() {
        cy.intercept('POST', '**/api/seo-resolve').as('seoResolve')
        cy.intercept('GET', '**/api/v2/header/info').as('headerInfo')
        cy.intercept('GET', '**/api/v2/header/cities').as('headerCities')
        cy.intercept('GET', '**/api/v2/basket').as('basket')
        cy.intercept('GET', '**/api/v2/favorites').as('favorites')
        cy.intercept('GET', '**/api/v2/user').as('user')
        cy.intercept('GET', '**/api/v3/catalog/menu').as('catalogMenu')
        cy.intercept('GET', '**/api/v3/popular/top-categories**').as('popularTop')
        cy.intercept('GET', '**/api/v3/popular/categories').as('popularCategories')
        cy.intercept('GET', '**/api/v3/publications/banners').as('banners')
        cy.intercept('GET', '**/api/v3/personal/recommendations').as('recommendations')
        cy.intercept('GET', '**/api/v3/personal/history').as('history')
        cy.intercept('GET', '**/api/v3/catalog/offers**').as('catalogOffers')
        cy.intercept('GET', '**/api/v3/catalog/meta**').as('catalogMeta')
        cy.intercept('GET', '**/api/v2/compare/small').as('compareSmall')
    }
    // Метод проверки всех запросов
    checkRequests() {
        cy.wait(10000)
        this.aliases.forEach(alias => {
            cy.wait(`@${alias}`).then(interception => {
                const status = interception.response?.statusCode
                // 401 допустимо для user, 204 для history, остальные 200
                if (alias === 'user') {
                    expect(status).to.be.oneOf([200, 401])
                } else if (alias === 'history') {
                    expect(status).to.be.oneOf([200, 204])
                } else {
                    expect(status).to.eq(200)
                }
                cy.log(`${alias}: ${status}`)
            })
        })
    }

    get popularCategoriesLinks() {
        return [
            'https://www.mechta.kz/useful/shares/',
            'https://www.mechta.kz/section/smartfony/apple-iphone/',
            'https://www.mechta.kz/section/smartfony/',
            'https://www.mechta.kz/section/naushniki/',
            'https://www.mechta.kz/section/noutbuki/',
            'https://www.mechta.kz/section/uborka-doma/',
            'https://www.mechta.kz/section/stiralnye-mashiny/',
            'https://www.mechta.kz/section/televizory/',
            'https://mechta.kz/section/aerogrili',
            'https://www.mechta.kz/section/holodilniki/',
            'https://www.mechta.kz/section/elektricheskie-chayniki',
            'https://mechta.kz/section/planshety'
        ]
    }

    // Геттер, который проверяет видимость всех ссылок
    get popularCategories() {
        cy.wait(10000)
        this.popularCategoriesLinks.forEach(link => {
            cy.get(`[href="${link}"]`).should('be.visible')
        })
    }

    get Header(){
        return cy.get('#reka-popover-trigger-v-0-0-0').should('be.visible')
    }

    get importantLinks() {
        return [
            '/mechta-shops/',
            'https://b2b.mechta.kz/',
            '/faq/'
        ]
    }

    // Метод для проверки видимости всех ссылок
    checkImportantLinksVisible() {
        this.importantLinks.forEach(link => {
            cy.get(`[href="${link}"]`).should('be.visible')
        })
    }
}

export default HomePage