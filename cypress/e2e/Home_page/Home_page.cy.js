describe('Главная страница', () => {

  it('Открывает базовый URL', () => {
    cy.visit('/')                  // откроет https://pp.yc.mechta.kz/
    cy.url().should('include', 'pp.yc.mechta.kz')
  })
})