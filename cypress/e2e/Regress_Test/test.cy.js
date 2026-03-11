import actionPage from '../../integration/pageObjects/action';

const ActionPage = new actionPage();

describe('Тестовый файл', () => {
    beforeEach(() => {
        cy.session('base-home', () => {
            cy.visit('/');
        });
    });

    it('Сравнение категорий из API и UI через intercept', () => {
        // 1. Перехватываем запрос (подставь свой URL)
        cy.intercept('GET', '/api/v3/promotions').as('promotions');

        cy.visit('/useful/shares/');

        // 2. Ждем ответа и работаем с данными
        cy.wait('@promotions').then((interception) => {
            const apiCategories = interception.response.body.categories;
            const apiCategoryNames = apiCategories.map(cat => cat.name.trim());

            // Ограничиваем поиск только внутри нужного контейнера
            cy.get('div[data-slot="container"]:visible')
                .first() // Берем первый из видимых контейнеров
                .within(() => {
                    // 2. Ищем элементы, исключая клоны слайдера (обычно у них есть спец. классы)
                    // Если это не поможет, используем проверку на уникальность через Set
                    cy.get('div[role="group"] p')
                        .then(($els) => {
                            const allTexts = [...$els].map(el => el.innerText.trim());

                            // Если слайдер наплодил клонов, превращаем массив в Set (уникальные значения)
                            // и обратно в массив
                            const uiCategoryNames = [...new Set(allTexts)];

                            // Теперь сравниваем
                            expect(uiCategoryNames.length).to.equal(
                                apiCategoryNames.length,
                                `После удаления дубликатов в UI осталось ${uiCategoryNames.length}, в API ${apiCategoryNames.length}`
                            );

                            expect(uiCategoryNames).to.deep.equal(apiCategoryNames);
                        });
                });
        });
    });
})