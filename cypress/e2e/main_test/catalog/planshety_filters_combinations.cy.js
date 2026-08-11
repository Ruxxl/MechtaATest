// Каталог: /section/planshety/ — КОМБИНАЦИИ фильтров ("проверить как они
// работают друг с другом", "проверить все комбинации"): логика ИЛИ внутри
// одной группы, логика И между разными группами, 3+ фильтра, пересечение = 0,
// порядок применения, сброс, цена+чекбоксы, гонки быстрых кликов.
//
// Каждое ожидаемое число сначала независимо получено живым запросом к API
// (getCatalogProducts/getCatalogFilters), а не захардкожено — см. skill п.3.
import SectionCatalogPage from '../../../support/pageObjects/catalog/sectionCatalogPage';
import { getCatalogFilters, getCatalogProducts, findFilterItem } from '../../../support/helpers/catalogFilterApi';

const Section = new SectionCatalogPage();
const SLUG = 'planshety';

describe('Планшеты: логика ИЛИ внутри одной группы', () => {

    it('2 бренда в группе "Бренд" — totalCount = сумма (без пересечения, у товара один бренд)', () => {
        getCatalogProducts(SLUG, '', { properties: { brend: ['samsung'] } }).then(({ body: a }) => {
            getCatalogProducts(SLUG, '', { properties: { brend: ['apple'] } }).then(({ body: b }) => {
                getCatalogProducts(SLUG, '', { properties: { brend: ['samsung', 'apple'] } }).then(({ body: both }) => {
                    expect(both.meta.totalCount).to.eq(a.meta.totalCount + b.meta.totalCount);

                    Section.visit(SLUG);
                    Section.clickFilterValueCheckbox('Бренд', 'Samsung');
                    Section.clickFilterValueCheckbox('Бренд', 'Apple');
                    Section.interceptCatalogProducts();
                    Section.clickApplyFiltersWithCount();
                    Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                        expect(interception.response.body.meta.totalCount).to.eq(both.meta.totalCount);
                        cy.url().should('include', 'properties[brend][]=samsung').and('include', 'properties[brend][]=apple');
                    });
                });
            });
        });
    });

    it('3 бренда в одной группе — totalCount = сумма всех трёх', () => {
        getCatalogProducts(SLUG, '', { properties: { brend: ['samsung', 'huawei', 'apple'] } }).then(({ body: expected }) => {
            Section.visit(SLUG);
            Section.clickFilterValueCheckbox('Бренд', 'Samsung');
            Section.clickFilterValueCheckbox('Бренд', 'Huawei');
            Section.clickFilterValueCheckbox('Бренд', 'Apple');
            Section.interceptCatalogProducts();
            Section.clickApplyFiltersWithCount();
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(expected.meta.totalCount);
            });
        });
    });
});

describe('Планшеты: логика И между разными группами', () => {

    it('бренд + "Есть скидка" — итог строго меньше каждого фильтра по отдельности', () => {
        getCatalogProducts(SLUG, '', { properties: { brend: ['huawei'] } }).then(({ body: brandOnly }) => {
            getCatalogProducts(SLUG, '', { properties: { discount: ['has_discount'] } }).then(({ body: discountOnly }) => {
                getCatalogProducts(SLUG, '', { properties: { brend: ['huawei'], discount: ['has_discount'] } }).then(({ body: both }) => {
                    expect(both.meta.totalCount).to.be.lessThan(brandOnly.meta.totalCount);
                    expect(both.meta.totalCount).to.be.lessThan(discountOnly.meta.totalCount);

                    Section.visit(SLUG);
                    Section.clickFilterValueCheckbox('Бренд', 'Huawei');
                    Section.clickFilterValueCheckbox('Есть скидка', 'Да');
                    Section.interceptCatalogProducts();
                    Section.clickApplyFiltersWithCount();
                    Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                        expect(interception.response.body.meta.totalCount).to.eq(both.meta.totalCount);
                        cy.url().should('include', 'properties[brend][]=huawei').and('include', 'properties[discount][]=has_discount');
                    });
                });
            });
        });
    });

    // Сверяем ОБА порядка клика с одним и тем же независимым API-эталоном, а не
    // друг с другом напрямую, и КАЖДЫЙ порядок — в своём отдельном it() (гонка
    // cy.intercept-алиаса при повторном cy.visit() в одном тесте, см. skill п.4)
    it('порядок A: бренд → скидка — итоговый totalCount совпадает с независимым API-эталоном', () => {
        getCatalogProducts(SLUG, '', { properties: { brend: ['huawei'], discount: ['has_discount'] } }).then(({ body: expected }) => {
            Section.visit(SLUG);
            Section.clickFilterValueCheckbox('Бренд', 'Huawei');
            Section.clickFilterValueCheckbox('Есть скидка', 'Да');
            Section.interceptCatalogProducts();
            Section.clickApplyFiltersWithCount();
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(expected.meta.totalCount);
            });
        });
    });

    it('порядок Б: скидка → бренд (обратный порядок) — тот же totalCount, что и в порядке A', () => {
        getCatalogProducts(SLUG, '', { properties: { brend: ['huawei'], discount: ['has_discount'] } }).then(({ body: expected }) => {
            Section.visit(SLUG);
            Section.clickFilterValueCheckbox('Есть скидка', 'Да');
            Section.clickFilterValueCheckbox('Бренд', 'Huawei');
            Section.interceptCatalogProducts();
            Section.clickApplyFiltersWithCount();
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(expected.meta.totalCount);
            });
        });
    });

    it('3 фильтра из 3 разных групп — каждый следующий уровень строго уменьшает totalCount (доказательный пример убывания)', () => {
        getCatalogProducts(SLUG, '', { properties: { brend: ['huawei'] } }).then(({ body: step1 }) => {
            getCatalogProducts(SLUG, '', { properties: { brend: ['huawei'], discount: ['has_discount'] } }).then(({ body: step2 }) => {
                getCatalogProducts(SLUG, '', { properties: { brend: ['huawei'], discount: ['has_discount'], 'tip-sim-karty': ['otsutstvuet'] } }).then(({ body: step3 }) => {
                    expect(step2.meta.totalCount).to.be.lessThan(step1.meta.totalCount);
                    expect(step3.meta.totalCount).to.be.lessThan(step2.meta.totalCount);
                    expect(step3.meta.totalCount).to.be.greaterThan(0);

                    Section.visit(SLUG);
                    Section.clickFilterValueCheckbox('Бренд', 'Huawei');
                    Section.clickFilterValueCheckbox('Есть скидка', 'Да');
                    Section.clickFilterValueCheckbox('Тип SIM-карты', 'Отсутствует');
                    Section.interceptCatalogProducts();
                    Section.clickApplyFiltersWithCount();
                    Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                        expect(interception.response.body.meta.totalCount).to.eq(step3.meta.totalCount);
                        const actualIds = interception.response.body.products.map((p) => p.id).sort();
                        // Полная сверка списка ID со сквозным API-запросом, а не только count
                        getCatalogProducts(SLUG, '', { properties: { brend: ['huawei'], discount: ['has_discount'], 'tip-sim-karty': ['otsutstvuet'] }, pageSize: 50 }).then(({ body: full }) => {
                            expect(actualIds).to.deep.eq(full.products.map((p) => p.id).sort());
                        });
                    });
                });
            });
        });
    });
});

describe('Планшеты: пересечение фильтров даёт 0 — не должно "зависать"', () => {

    it('бренд + скидка с пустым пересечением (Apple ни разу не участвует в скидках) — API отдаёт 204, фронт показывает понятное пустое состояние, а не бесконечную загрузку', () => {
        getCatalogFilters(SLUG, '', { brend: ['apple'] }).then(({ body }) => {
            const discountItem = findFilterItem(body, 'discount', 'has_discount');
            expect(discountItem?.count ?? 0, 'фикстура должна давать пересечение 0 для этой пары').to.eq(0);
        });

        Section.visit(SLUG);
        Section.clickFilterValueCheckbox('Бренд', 'Apple');
        Section.assertFilterValueDisabled('Есть скидка', 'Да');

        // Deep-link напрямую на заведомо пустое пересечение — проверяем именно
        // отрисовку пустого состояния, а не то, что чекбокс задизейблен
        cy.intercept('GET', '**/api/v3/catalog/products**').as('emptyProducts');
        cy.visit(`/section/${SLUG}/?page=1&properties[brend][]=apple&properties[discount][]=has_discount`);
        cy.wait('@emptyProducts', { timeout: 20000 });
        cy.contains(/ничего не наш|не найден|нет результатов/i, { timeout: 10000 }).should('be.visible');
        Section.totalCountHeading.should('contain.text', '0');
    });

    it('после пустого пересечения оставшиеся доступные (не задизейбленные) значения в других группах видны и работают', () => {
        Section.visit(SLUG);
        Section.clickFilterValueCheckbox('Бренд', 'Apple');
        // "Есть скидка" обнулилась, но сам бренд Apple(16) остаётся доступным —
        // группа "Специальные предложения" (recommendations, count=71 у всех
        // товаров без фильтра) должна остаться доступной после выбора Apple
        Section.assertFilterValueEnabled('Специальные предложения', 'Подборки и рекомендации');
    });
});

describe('Планшеты: фильтр + цена — тоже комбинация, а не два независимых механизма', () => {

    // РАЗВЕДКА 2026-08-11: UI-сценарий "сначала кликнуть чекбокс бренда, потом
    // ввести цену" в Cypress (.clear().type()) не подхватывает цену в финальном
    // запросе (итог = только бренд), хотя поля визуально показывают введённые
    // значения. Проверено через claude-in-chrome с НАСТОЯЩИМИ (isTrusted)
    // событиями мыши/клавиатуры в той же последовательности — на реальном
    // сайте комбинация применяется корректно (счётчик сразу пересчитывается,
    // "Показать 12 результатов" вместо "19"). Это тот же класс проблемы, что
    // и feedback_cypress_untrusted_click_limitation — программный ввод в поле
    // цены, следующий сразу за чекбокс-триггерным живым пересчётом, не
    // полностью подхватывается реактивностью приложения в среде Cypress. Не
    // баг сайта — ограничение автотеста. Проверяем ту же комбинацию через
    // deep-link (URL сразу содержит оба параметра), что functionally
    // эквивалентно и не зависит от этого ограничения.
    it('бренд + ценовой диапазон одновременно сужают выборку корректно (И между чекбоксом и ценой) — через deep-link', () => {
        getCatalogFilters(SLUG, '', { brend: ['samsung'] }).then(({ body }) => {
            const { minPrice, maxPrice } = body.priceRange;
            const midPrice = Math.round((minPrice + maxPrice) / 2);
            getCatalogProducts(SLUG, '', { properties: { brend: ['samsung'] }, minPrice, maxPrice: midPrice }).then(({ body: expected }) => {
                expect(expected.meta.totalCount, 'фикстура должна давать >0 результатов').to.be.greaterThan(0);
                Section.interceptCatalogProducts();
                cy.visit(`/section/${SLUG}/?page=1&properties[brend][]=samsung&minPrice=${minPrice}&maxPrice=${midPrice}`);
                Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                    expect(interception.response.body.meta.totalCount).to.eq(expected.meta.totalCount);
                });
                Section.assertFilterValueChecked('Бренд', 'Samsung');
                Section.priceInputs.eq(0).invoke('val').then((v) => expect(Number(v.replace(/\s/g, ''))).to.eq(minPrice));
                Section.priceInputs.eq(1).invoke('val').then((v) => expect(Number(v.replace(/\s/g, ''))).to.eq(midPrice));
            });
        });
    });
});

describe('Планшеты: сброс фильтров', () => {

    it('переход на чистый URL (без query) после применённого фильтра возвращает полную выборку категории', () => {
        getCatalogProducts(SLUG, '').then(({ body: full }) => {
            cy.intercept('GET', `**/api/v3/catalog/products*slug=${SLUG}*`).as('unfilteredProducts');
            // Cache-busting — /section/planshety/ уже мог посещаться в этом файле
            cy.visit(`/section/${SLUG}/?_cb=${Date.now()}`);
            cy.wait('@unfilteredProducts', { timeout: 20000 }).then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(full.meta.totalCount);
            });
            cy.url().should('not.include', 'properties');
        });
    });

    it('применённый фильтр переживает cy.reload() (сохраняется в URL, а не только в состоянии SPA)', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            const item = findFilterItem(body, 'brend', 'samsung');
            Section.visit(SLUG);
            Section.clickFilterValueCheckbox('Бренд', item.value);
            Section.interceptCatalogProducts();
            Section.clickApplyFiltersWithCount();
            Section.waitCatalogProducts({ timeout: 20000 });
            cy.url().should('include', 'properties[brend][]=samsung');

            Section.interceptCatalogProducts();
            cy.reload();
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(item.count);
            });
        });
    });
});

describe('Планшеты: нестандартные/гоночные сценарии', () => {

    it('быстрое переключение 2 чекбоксов в одной группе без ожидания — итог соответствует ПОСЛЕДНЕМУ консистентному состоянию', () => {
        getCatalogProducts(SLUG, '', { properties: { brend: ['huawei'] } }).then(({ body: expected }) => {
            Section.visit(SLUG);
            // samsung: check -> uncheck; huawei: check — итог должен быть только huawei
            Section.clickFilterValueCheckbox('Бренд', 'Samsung');
            Section.clickFilterValueCheckbox('Бренд', 'Samsung');
            Section.clickFilterValueCheckbox('Бренд', 'Huawei');
            Section.interceptCatalogProducts();
            Section.clickApplyFiltersWithCount();
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                cy.url().should('include', 'properties[brend][]=huawei').and('not.include', 'properties[brend][]=samsung');
                expect(interception.response.body.meta.totalCount).to.eq(expected.meta.totalCount);
            });
        });
    });

    it('двойной клик по одному чекбоксу регистрируется как ОДНО переключение (защита от дребезга), итог применяется корректно', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            const item = findFilterItem(body, 'brend', 'samsung');
            Section.visit(SLUG);
            Section.getFilterValueCheckbox('Бренд', item.value).should('have.attr', 'data-state', 'unchecked').dblclick({ force: true });
            Section.getFilterValueCheckbox('Бренд', item.value).should('have.attr', 'data-state', 'checked');

            Section.interceptCatalogProducts();
            Section.clickApplyFiltersWithCount();
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(item.count);
            });
        });
    });

    it('deep-link URL с фильтрами из ДВУХ разных групп сразу — обе применяются одновременно при первом заходе', () => {
        getCatalogProducts(SLUG, '', { properties: { brend: ['huawei'], discount: ['has_discount'] } }).then(({ body: expected }) => {
            Section.interceptCatalogProducts();
            cy.visit(`/section/${SLUG}/?page=1&properties[brend][]=huawei&properties[discount][]=has_discount`);
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(expected.meta.totalCount);
            });
            Section.assertFilterValueChecked('Бренд', 'Huawei');
            Section.assertFilterValueChecked('Есть скидка', 'Да');
        });
    });
});
