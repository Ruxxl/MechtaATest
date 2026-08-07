// TC-INFO-13 из Mechta_ProductPage_TestCases.xlsx: выбор цвета/памяти/состояния на
// странице товара — виджет, который пользователь заметил непокрытым. Это ТОТ ЖЕ
// механизм /similar, что уже покрыт для кондиционеров (page_blocks.cy.js, площадь
// помещения), но с разными группами характеристик. По просьбе пользователя тест
// параметризован и гоняется на ВСЕХ ТРЁХ известных товарах с этим виджетом, и после
// каждого клика сверяются НЕ ТОЛЬКО isCurrent в /similar, а название, цена и (где
// применимо) характеристика на новой странице — реальный товар, а не просто смена URL.
//
// Разведка 2026-08-05 нашла ТРИ разных типа группы в /similar, с РАЗНОЙ разметкой:
// - type "image" (Цвет корпуса) и type "text" c >1 вариантом (Объем памяти, Площадь
//   помещения) — кнопки <button> без роли ссылки, скоупятся через заголовок-<p> и
//   его ближайший sibling (getVariantGroupButtons), активный маркер — класс
//   border-mi-brand-base-brand-secondary (тот же, что у активной миниатюры галереи).
// - type "text" с РОВНО 1 вариантом (нечего переключать) — не интерактивен.
// - type "defective" (Уценённые/Состояние) — ЕДИНСТВЕННЫЙ особый случай: DOM-заголовок
//   ("Состояние") НЕ совпадает с group.name из API ("Уценённые"); варианты — обычные
//   <a href="/product/{slug}/">, а не <button>; "Новый" (текущий товар) — ссылка САМА
//   НА СЕБЯ и её нет в products[] ответа API; активный маркер — класс
//   ring-mi-brand-line-brand! (другой, не border-mi-brand-base-brand-secondary).
//   Связь ОДНОСТОРОННЯЯ: подтверждено напрямую через API — у самого "Уценённого"
//   варианта в /similar группы "Уценённые" нет вообще (нет пути назад к "Новому"
//   этим же виджетом) — не баг, так пришли данные, это задокументировано, а не
//   предполагается.
//
// ВАЖНО: клик по каждой переключаемой группе — ОТДЕЛЬНЫЙ it(), а не forEach внутри
// одного теста. Первая версия гоняла все группы товара (например "Объем памяти" И
// "Цвет корпуса" у iPhone 17 Pro Max) в одном it() через forEach с повторным
// cy.visit()/interceptRequests() — это стабильно ловило гонку (см. skill п.4,
// "cy.intercept alias race"): вторая итерация получала перепутанные данные первой
// (наблюдалось как несуществующая комбинация вида "256gb-silver" вместо реальной
// "2tb-silver"). Список переключаемых групп на товар зафиксирован здесь заранее
// (подтверждено напрямую через API, не вычисляется динамически внутри теста) —
// именно это и даёт возможность сделать по одному it() на группу.
import productPage from '../../../../support/pageObjects/product_page';
import products from '../../../../fixtures/products.json';
import { normalizePrice } from '../../../../support/helpers/textUtils';

const ProductPage = new productPage();

const targets = [
    { label: 'кондиционер (площадь помещения)', ...products.onlyShopwindow, switchableGroups: ['Площадь обслуживаемого помещения'], hasCondition: false },
    { label: 'iPhone 17e (цвет)', ...products.withColorVariants, switchableGroups: ['Цвет корпуса'], hasCondition: false },
    // ВАЖНО: реальное имя группы в API — "Объем" (буква "е"), а не "Объём" (буква
    // "ё") — опечатка в этой строке (изначально была написана с "ё") стабильно
    // проваливала поиск группы по имени именно на ЭТОМ товаре (единственном, где
    // вообще есть слово с этой буквой) и выглядела как гонка/race condition,
    // хотя это была обычная опечатка в одну букву
    { label: 'iPhone 17 Pro Max 2TB (память + цвет + состояние)', ...products.withColorMemoryCondition, switchableGroups: ['Объем встроенной памяти', 'Цвет корпуса'], hasCondition: true },
];

function slugFromUrl(url) {
    return url.replace(/^\/product\//, '').replace(/\/$/, '');
}

// Разведкой подтверждено: широкий wildcard-алиас '@similar' из interceptRequests()
// (**/api/v3/product/*/similar) на товарах с несколькими группами виджета иногда
// ловит ЧУЖОЙ /similar-запрос (похоже, префетч соседних вариантов/карточек, не
// относящийся к текущему товару) вместо реального ответа для текущей страницы —
// стабильно воспроизводилось именно на iPhone 17 Pro Max (единственный товар с
// тремя группами widget'а сразу). Фикс — интерцепт, скоупленный ТОЧНЫМ slug'ом
// текущего товара, а не любым product/*/similar.
function interceptSimilarForSlug(slug, alias) {
    cy.intercept('GET', `**/api/v3/product/${slug}/similar`).as(alias);
}

function assertGroupsMatchApi(label, url) {
    ProductPage.interceptRequests();
    interceptSimilarForSlug(slugFromUrl(url), 'similarForThisProduct');
    cy.visit(url);
    cy.wait('@similarForThisProduct', { timeout: 20000 }).then((interception) => {
        const groups = interception.response.body;
        expect(groups, `фикстура "${label}" должна иметь непустой /similar`).to.have.length.greaterThan(0);

        groups.forEach((group) => {
            if (group.type === 'defective') {
                // Особый случай — см. заголовок файла. products[] содержит
                // только АЛЬТЕРНАТИВУ ("Уценённый"), текущий товар в неё не входит
                group.products.forEach((variant) => {
                    ProductPage.conditionLink(variant.slug).should('exist');
                    ProductPage.assertConditionLinkActive(variant.slug, false);
                });
                const currentSlug = url.replace(/^\/product\//, '').replace(/\/$/, '');
                ProductPage.assertConditionLinkActive(currentSlug, true);
                return;
            }

            if (group.products.length <= 1) {
                // Единственный вариант — нечего переключать (граничный случай)
                ProductPage.getVariantGroupButtons(group.name).should('have.length', group.products.length);
                return;
            }

            const currentIndex = group.products.findIndex((p) => p.isCurrent);
            expect(group.products.filter((p) => p.isCurrent), `группа "${group.name}": ровно один текущий вариант`).to.have.length(1);

            ProductPage.getVariantGroupButtons(group.name).should('have.length', group.products.length);
            ProductPage.assertActiveVariantIndexInGroup(group.name, currentIndex);
        });
    });
}

function assertClickingGroupNavigatesCorrectly(url, groupName) {
    ProductPage.interceptRequests();
    interceptSimilarForSlug(slugFromUrl(url), 'similarForThisProduct');
    cy.visit(url);
    cy.wait('@similarForThisProduct', { timeout: 20000 }).then((fresh) => {
        const freshGroup = fresh.response.body.find((g) => g.name === groupName);
        expect(freshGroup, `группа "${groupName}" должна быть в /similar`).to.exist;
        const otherIndex = freshGroup.products.findIndex((p) => !p.isCurrent);
        const other = freshGroup.products[otherIndex];

        interceptSimilarForSlug(other.slug, 'similarAfterClick');
        cy.intercept('GET', `**/api/v3/product/${other.slug}`).as('productAfterClick');
        ProductPage.clickVariantInGroup(freshGroup.name, otherIndex);
        cy.url().should('include', other.slug);

        cy.wait('@similarAfterClick', { timeout: 20000 }).then((i2) => {
            const newGroup = i2.response.body.find((g) => g.name === freshGroup.name);
            const newCurrentIndex = newGroup.products.findIndex((p) => p.isCurrent);
            expect(newGroup.products[newCurrentIndex].slug, `группа "${groupName}": на новой странице текущим должен быть выбранный вариант`).to.eq(other.slug);
        });

        // Реальный товар на новой странице — не только URL/isCurrent, но и название,
        // цена, и (для текстовых характеристик вроде памяти) соответствующее значение
        // в mainProperties
        cy.wait('@productAfterClick', { timeout: 20000 }).then((productInterception) => {
            const apiBody = productInterception.response.body;
            expect(apiBody.slug, `группа "${groupName}": /product на новой странице должен быть для выбранного slug`).to.eq(other.slug);

            cy.get('#product-name', { timeout: 20000 }).should('have.text', apiBody.name);

            cy.get('#product-final-price').invoke('text').then((priceText) => {
                expect(normalizePrice(priceText)).to.eq(apiBody.prices.finalPrice.toString());
            });

            if (freshGroup.type === 'text') {
                const matchingProperty = apiBody.mainProperties.find((p) => p.value === other.property);
                expect(matchingProperty, `группа "${groupName}": mainProperties должен содержать значение "${other.property}" после переключения`).to.exist;
            }
        });
    });
}

function assertClickingConditionNavigatesCorrectly(url) {
    ProductPage.interceptRequests();
    interceptSimilarForSlug(slugFromUrl(url), 'similarForThisProduct');
    cy.visit(url);
    cy.wait('@similarForThisProduct', { timeout: 20000 }).then((interception) => {
        const defectiveGroup = interception.response.body.find((g) => g.type === 'defective');
        expect(defectiveGroup, 'должна быть группа "Уценённые"').to.exist;
        const alternative = defectiveGroup.products[0];

        cy.intercept('GET', `**/api/v3/product/${alternative.slug}`).as('productAfterCondition');
        ProductPage.conditionLink(alternative.slug).click();
        cy.url().should('include', alternative.slug);

        cy.wait('@productAfterCondition', { timeout: 20000 }).then((productInterception) => {
            expect(productInterception.response.body.slug).to.eq(alternative.slug);
            cy.get('#product-name', { timeout: 20000 }).should('have.text', productInterception.response.body.name);
        });
    });
}

describe('Страница товара: виджет выбора варианта — цвет/память/состояние (TC-INFO-13)', () => {

    targets.forEach(({ label, url, switchableGroups, hasCondition }) => {

        describe(`Товар: ${label}`, () => {

            it('ПОЗИТИВ: каждая переключаемая группа из /similar корректно отражена в UI (кол-во кнопок, активный индекс)', () => {
                assertGroupsMatchApi(label, url);
            });

            switchableGroups.forEach((groupName) => {
                it(`ПОЗИТИВ: клик по другому варианту в группе "${groupName}" переводит на страницу этого варианта — сверены URL, isCurrent, название, цена и (где применимо) характеристика`, () => {
                    assertClickingGroupNavigatesCorrectly(url, groupName);
                });
            });

            if (hasCondition) {
                it('ПОЗИТИВ: клик по "Уценённый" (группа "Состояние") реально переводит на страницу этого варианта с соответствующим названием', () => {
                    assertClickingConditionNavigatesCorrectly(url);
                });
            }
        });
    });
});