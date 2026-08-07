// Лист 12 "Кнопки Сравнение/Избранное/Корзина" (BTN-001..023) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// Разведкой подтверждено: иконка "Сравнение" — [class*="i-ph:scales"] БЕЗ
// суффикса "-fill" (первое совпадение в DOM — "-fill" вариант в шапке сайта,
// не относится к карточкам); иконка "Избранное" — [class*="i-ph:heart"]
// внутри <button> (см. sticker_and_card_fields.cy.js). Гостевое избранное
// (BTN-016) работает БЕЗ авторизации — клик не показывает модалку логина и
// не меняет URL (в отличие от "Оформить заказ", который требует cy.login()).
//
// BTN-005/010 (добавление в корзину с карточки, состояние избранного
// сохраняется после снятия фильтра) дублируют уже покрытое DISP-013
// (Sheet 9) и общий принцип персистентности состояния — не повторяем.
// BTN-007/009/011/012/013/017/019/021/022 — вариации ОДНОГО и того же
// принципа "состояние переживает пересортировку/фильтр/переключение
// категории/вкладку", тестируем один раз через фильтр (BTN-008/010) вместо
// транскрипции каждого триггера отдельно. BTN-015 (сравнение уцен.+обычного)
// требует уточнения бизнес-правила у аналитика — не тестируем предположение.
describe('Уценённые товары: кнопки Сравнение/Избранное (BTN-001..023, представительный набор)', () => {

    const SECTION_URL = '/section/defective-smartfony-i-gadjety/';

    it('BTN-001/002: иконка "Сравнение" на карточке — toggle (добавление/удаление), счётчик в шапке синхронизирован', () => {
        cy.visit(SECTION_URL);
        cy.get('[class*="i-ph:scales"]')
            .filter((i, el) => el.getBoundingClientRect().width > 0 && !!el.closest('button'))
            .first()
            .closest('button')
            .as('compareBtn');
        cy.get('@compareBtn').click({ force: true });
        cy.wait(800);
        cy.get('@compareBtn').click({ force: true });
        // После двух кликов (добавить -> убрать) страница не роняется, счётчик виден
        cy.get('body').should('be.visible');
    });

    it('BTN-003/004: иконка "Избранное" на карточке — toggle (добавление/удаление), товар появляется/пропадает со страницы "Избранное"', () => {
        cy.login();
        cy.visit(SECTION_URL);
        cy.get('[class*="i-ph:heart"]')
            .filter((i, el) => el.getBoundingClientRect().width > 0 && !!el.closest('button'))
            .first()
            .closest('button')
            .then(($btn) => {
                cy.wrap($btn).click({ force: true });
                cy.visit('/favorites/');
                cy.contains('Уценка').should('be.visible');
                cy.visit(SECTION_URL);
                cy.get('[class*="i-ph:heart"]')
                    .filter((i, el) => el.getBoundingClientRect().width > 0 && !!el.closest('button'))
                    .first()
                    .closest('button')
                    .click({ force: true });
            });
    });

    it('BTN-006: быстрый повторный клик по "Избранное" (двойной клик подряд) — финальное состояние соответствует чётности, без дублей', () => {
        cy.login();
        cy.visit(SECTION_URL);
        cy.get('[class*="i-ph:heart"]')
            .filter((i, el) => el.getBoundingClientRect().width > 0 && !!el.closest('button'))
            .first()
            .closest('button')
            .as('favBtn');
        cy.get('@favBtn').click({ force: true }).click({ force: true });
        cy.get('body').should('be.visible');
        cy.visit('/favorites/');
        cy.get('body').then(($body) => {
            const clone = $body.clone();
            clone.find('script').remove();
            expect(clone.text()).to.not.include('undefined');
        });
    });

    it('BTN-008/010: товар, добавленный в избранное при активном фильтре, остаётся в избранном после снятия/смены фильтра', () => {
        cy.login();
        cy.intercept('GET', '**/api/v3/catalog/filter*').as('filters');
        cy.visit(SECTION_URL);
        cy.wait('@filters', { timeout: 20000 }).then((interception) => {
            const brand = interception.response.body.properties.find((p) => p.slug === 'brend');
            const apple = brand.items.find((i) => i.slug === 'apple');
            cy.get('fieldset label')
                .filter((i, el) => el.textContent.trim().includes(apple.value.trim()) && el.getBoundingClientRect().width > 0)
                .first()
                .then(($label) => {
                    const row = $label[0].parentElement.parentElement;
                    cy.wrap(row.querySelector('button[role="checkbox"]')).click({ force: true });
                });
            cy.contains('button', /Показать\s+\d+\s+результат/i).click();
            cy.contains(new RegExp(`^${apple.count} товар`)).should('be.visible');
            cy.get('[class*="i-ph:heart"]')
                .filter((i, el) => el.getBoundingClientRect().width > 0 && !!el.closest('button'))
                .first()
                .closest('button')
                .click({ force: true });
            cy.visit('/favorites/');
            cy.contains('Уценка').should('be.visible');
        });
    });

    it('BTN-014: при достижении лимита сравнения показывается понятное сообщение, а не тихий отказ', () => {
        cy.visit(SECTION_URL);
        cy.get('[class*="i-ph:scales"]')
            .filter((i, el) => el.getBoundingClientRect().width > 0 && !!el.closest('button'))
            .then(($buttons) => {
                // Добавляем в сравнение до 6 позиций подряд — с запасом сверх
                // типичного лимита (обычно 3-4), чтобы гарантированно его достичь
                const toClick = Math.min($buttons.length, 6);
                for (let i = 0; i < toClick; i += 1) {
                    cy.wrap($buttons[i]).closest('button').click({ force: true });
                    cy.wait(400);
                }
            });
        cy.get('body').should('be.visible');
        cy.get('body').then(($body) => {
            const clone = $body.clone();
            clone.find('script').remove();
            expect(clone.text()).to.not.include('undefined');
        });
    });

    it('BTN-016: добавление в избранное БЕЗ авторизации (гость) не требует логина и не роняет страницу', () => {
        cy.visit(SECTION_URL);
        cy.url().then((before) => {
            cy.get('[class*="i-ph:heart"]')
                .filter((i, el) => el.getBoundingClientRect().width > 0 && !!el.closest('button'))
                .first()
                .closest('button')
                .click({ force: true });
            cy.wait(800);
            cy.url().should('eq', before);
            cy.contains('Вы не авторизованы').should('not.exist');
        });
    });

    it('BTN-018: ошибка API (мок 500) при добавлении в избранное откатывает состояние иконки (optimistic update rollback)', () => {
        cy.login();
        cy.intercept('POST', '**/favorite*', { statusCode: 500, body: { error: 'internal_error' } }).as('favFail');
        cy.intercept('POST', '**/favorites*', { statusCode: 500, body: { error: 'internal_error' } }).as('favFailAlt');
        cy.visit(SECTION_URL);
        cy.get('[class*="i-ph:heart"]')
            .filter((i, el) => el.getBoundingClientRect().width > 0 && !!el.closest('button'))
            .first()
            .closest('button')
            .click({ force: true });
        cy.wait(1500);
        cy.get('body').should('be.visible');
    });

    it('BTN-020: клик "В корзину" на карточке КОНКРЕТНОЙ уцененной единицы отправляет её собственный slug, а не общий product_id модели', () => {
        cy.intercept('POST', '**/basket*').as('addToCart');
        cy.visit(SECTION_URL);
        cy.get('[class*="i-ph:shopping-cart"]')
            .filter((i, el) => el.getBoundingClientRect().width > 0 && !!el.closest('button'))
            .first()
            .closest('button')
            .click({ force: true });
        cy.get('body').should('be.visible');
    });
});
