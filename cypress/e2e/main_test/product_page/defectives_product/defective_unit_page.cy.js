// Лист 2 "Страница уцен. товара" (TC-020..027) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// Разведка 2026-08-06:
// - Страница уценённой единицы (/product/{slug}_{serial}/) показывает блок
//   Состояние/Дефекты/Упаковка/Комплект/Адрес нахождения, стикер "Уценка" и
//   пилюли "Новый"/"Уцененный N" (переключатель состояния). Клик "Новый"
//   переходит на /product/{baseProductSlug}/ (обычный товар той же модели).
// - КРИТИЧНО (подтверждено пользователем 2026-08-06): сегодня выпущена НОВАЯ
//   функциональность — уценённые товары теперь можно заказывать с обычной
//   курьерской доставкой, ограничение "только самовывоз" из тест-плана
//   (TC-021, TC-031..035) СНЯТО намеренно, это не баг. См.
//   BugReport/Товар/defectives_product/README.md ("Что НЕ было оформлено как
//   баг") и memory project-defectives-delivery-feature-change. TC-021 ниже
//   переписан под новое поведение: проверяем, что ОБА способа доставки
//   доступны, а не ищем текст про "только самовывоз".
// - /product/{slug}/ для уценённой единицы содержит defectiveDetails.baseProductSlug
//   (используется кнопкой "Новый"), defectiveDetails.serialNumber (суффикс slug).
// - Невалидный slug -> собственная 404-страница ("Упс... Мы не можем найти
//   то, что Вы ищете" + "Вернуться на сайт"), без белого экрана.
import productPage from '../../../../support/pageObjects/product_page';
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const ProductPage = new productPage();
const DefectiveProduct = new defectiveProduct();

describe('Уценённые товары: страница уцен. товара (TC-020..027)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    it('TC-020: страница уцен. товара показывает Состояние/Дефекты/Упаковку/Комплект/Адрес/цену/стикер "Уценка", данные совпадают с API', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            const { defectiveDetails, prices } = interception.response.body;
            cy.contains(defectiveDetails.defectType.trim()).should('be.visible');
            defectiveDetails.details.forEach((line) => {
                cy.contains(line).should('be.visible');
            });
            cy.contains(defectiveDetails.packageState).should('be.visible');
            cy.contains(defectiveDetails.componentsState).should('be.visible');
            cy.contains('Уценка').should('be.visible');
            const priceRegex = new RegExp(String(prices.finalPrice).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00A0]?'));
            cy.contains(priceRegex).should('be.visible');
        });
    });

    // ПЕРЕПИСАН под новую функциональность доставки (см. заголовок файла) —
    // изначальный TC-021 ожидал предупреждение "только самовывоз", которого
    // больше нет: сейчас доступны ОБА способа доставки
    it('TC-021 (адаптирован): для уцен. товара доступны оба способа доставки — "Самовывоз" и "Доставка", без блокирующего предупреждения', () => {
        cy.visit(fixtures.defectiveUnit.url);
        cy.contains('Способ доставки').should('be.visible');
        cy.contains(/Самовывоз/).should('be.visible');
        cy.contains(/Доставка/).should('be.visible');
    });

    it('TC-022: кнопка "Новый" переводит на страницу обычного товара той же модели (product_id/slug соответствует API)', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            const { baseProductSlug } = interception.response.body.defectiveDetails;
            // Разведкой подтверждено: пилюля "Новый" — это <a>, а не <button>
            cy.contains('a', 'Новый').click();
            cy.url().should('include', `/product/${baseProductSlug}/`);
            cy.url().should('not.include', 'defective');
        });
    });

    // Пользователь верно указал: baseProductSlug=null — нереалистичный кейс
    // (раз есть уценённая позиция, базовый товар модели логически всегда
    // существовал). Реалистичный кейс из плана — "product_id ссылается на
    // УДАЛЁННЫЙ товар", т.е. valid-looking slug, который сам возвращает 404
    it('TC-023 / БАГ: если baseProductSlug ссылается на удалённый товар — клик "Новый" не должен приводить к 404 на фронте', () => {
        cy.intercept('GET', '**/api/v3/product/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v*', (req) => {
            req.continue((res) => {
                res.body.defectiveDetails.baseProductSlug = 'deleted-product-slug-xyz';
            });
        }).as('productDeletedBase');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productDeletedBase', { timeout: 20000 });
        cy.contains('a', 'Новый').click();
        cy.contains(/не можем найти|не найден/i).should('not.exist');
    });

    it('TC-024: два разных экземпляра одной модели имеют собственные уникальные slug/URL', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@product', { timeout: 20000 }).then((interceptionA) => {
            const detailsA = interceptionA.response.body.defectiveDetails;
            cy.visit(fixtures.defectiveUnitSibling.url);
            cy.wait('@product', { timeout: 20000 }).then((interceptionB) => {
                const detailsB = interceptionB.response.body.defectiveDetails;
                expect(detailsA.baseProductSlug, 'обе позиции — одна и та же базовая модель').to.eq(detailsB.baseProductSlug);
                expect(detailsA.serialNumber, 'серийные номера должны отличаться').to.not.eq(detailsB.serialNumber);
                expect(fixtures.defectiveUnit.url, 'URL первой позиции').to.not.eq(fixtures.defectiveUnitSibling.url);
            });
        });
    });

    it('TC-025: переход по несуществующему slug уцен. товара показывает корректную страницу 404, без белого экрана и JS-ошибок', () => {
        const errors = [];
        cy.on('window:before:load', (win) => {
            win.addEventListener('error', (e) => { if (!e.message.includes("reading 'add'")) errors.push(e.message); });
        });
        cy.visit('/product/incorrect-slug-xyz/', { failOnStatusCode: false });
        cy.contains(/не можем найти|не найден/i).should('be.visible');
        cy.contains('a, button', /Вернуться на сайт/i).should('be.visible');
        cy.then(() => {
            expect(errors, 'страница 404 не должна давать JS-ошибок').to.have.length(0);
        });
    });

    it('TC-026: товар, только что распроданный (остаток обнулился) — статус "Продано/недоступно", кнопка "Купить" скрыта/заблокирована', () => {
        cy.intercept('GET', '**/api/v3/product/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v*', (req) => {
            req.continue((res) => {
                res.body.availability = 'notAvailable';
            });
        }).as('productSoldOut');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productSoldOut', { timeout: 20000 });
        cy.contains(/нет в наличии|недоступен|продан/i).should('be.visible');
        cy.get('body').then(($body) => {
            const buyButtons = [...$body[0].querySelectorAll('button')].filter(
                (el) => /^В корзину$|^Купить сейчас$/.test(el.textContent.trim()) && el.getBoundingClientRect().width > 0,
            );
            expect(buyButtons.every((el) => el.disabled), 'кнопки покупки должны быть скрыты или задизейблены для распроданного товара').to.eq(true);
        });
    });

    // Настоящий race condition между двумя вкладками недоступен в рамках одного
    // Cypress-теста (одна browser context) — приближаем сценарий: свежий визит
    // ПОСЛЕ того как availability стал notAvailable должен корректно показать
    // актуальный статус, а не закешированный "в наличии"
    it('TC-027 (приближение race condition): повторный визит на страницу товара после изменения availability отражает актуальный (недоступен) статус', () => {
        cy.intercept('GET', '**/api/v3/product/smartfon-apple-iphone-17-pro-max-256gb-silver_c6y7wgc06v*', (req) => {
            req.continue((res) => {
                res.body.availability = 'notAvailable';
            });
        }).as('productSoldOut');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productSoldOut', { timeout: 20000 });
        cy.reload();
        cy.wait('@productSoldOut', { timeout: 20000 });
        cy.contains(/нет в наличии|недоступен|продан/i).should('be.visible');
    });
});
