describe('Главная страница', () => {

    it('Открывает базовый URL', () => {
        cy.visit('/').wait(2000)
        cy.get('a[aria-label="Visit\\ Samsung"] > img.group-has-hover\\:scale-88.transition-all').click()
    })})