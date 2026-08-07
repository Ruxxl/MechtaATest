import DetailPage from '../../../support/pageObjects/actions/detailPage';
import { getCatalogFilters, getCatalogProducts, findFilterItem } from '../../../support/helpers/catalogFilterApi';

const Detail = new DetailPage();

// Тесты по плану TestPlans/FP-filters-subcategories-testplan.md (FP-001..FP-055):
// подкатегории и фильтры на детальной странице акции (/useful/shares/{slug}/).
//
// Отдельный файл (не detail.cy.js) — по явной просьбе, чтобы не мешать уже
// проходящим тестам. Использует ту же акцию/категорию/подкатегорию во всех
// кейсах (bonusy-za-otzyv → tehnika-dlya-doma → uborka-doma/uhod-za-veshchami),
// подобранную разведкой 2026-08-04 так, чтобы у неё было МНОГО групп фильтров
// (11 у "Пылесосов"), в отличие от "Ноутбуков" из detail.cy.js (всего 3 группы).
//
// Ключевые факты, опровергающие исходный план (проверено напрямую через API и
// UI, см. BugReport/Акции/README.md и BUG-004):
// - Применение фильтра — это ПОЛНОЦЕННАЯ навигация с реальными fetch-запросами
//   к /api/v3/catalog/{category,filter,products,offers} — cy.intercept работает
//   штатно, вопреки предупреждению плана.
// - Счётчики соседних значений пересчитываются вживую (ещё до клика «Показать»)
//   через повторные запросы к /catalog/filter — это XHR поверх текущей страницы.
// - Подкатегория переиспользует query-параметр `category` (не отдельный `subcategory=`).
describe('Детальная страница акции: подкатегории и фильтры (FP-*)', () => {

    let data;
    before(() => {
        cy.fixture('actionsData').then((d) => { data = d; });
    });

    describe('Подкатегории меняют фильтры', () => {

        it('FP-001: категория без подкатегории показывает объединённые фильтры (totalCount = сумма подкатегорий)', () => {
            getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug).then(({ body: sub1 }) => {
                getCatalogFilters(data.filterSubcategory2Slug, data.filterPromoSlug).then(({ body: sub2 }) => {
                    getCatalogFilters(data.filterCategorySlug, data.filterPromoSlug).then(({ body: parent }) => {
                        expect(parent.totalCount, 'totalCount родительской категории = сумма подкатегорий')
                            .to.eq(sub1.totalCount + sub2.totalCount);

                        Detail.interceptCatalogFilter();
                        Detail.visit(data.filterPromoSlug, `?category=${data.filterCategorySlug}`);
                        Detail.waitCatalogFilter().then((interception) => {
                            expect(interception.response.body.totalCount).to.eq(parent.totalCount);
                        });
                    });
                });
            });
        });

        it('FP-002: подкатегория меняет НАБОР групп фильтров, а не только значения внутри них', () => {
            getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug).then(({ body: sub1 }) => {
                getCatalogFilters(data.filterSubcategory2Slug, data.filterPromoSlug).then(({ body: sub2 }) => {
                    const groups1 = sub1.properties.map((p) => p.slug);
                    const groups2 = sub2.properties.map((p) => p.slug);
                    expect(groups1, 'группа "Сбор жидкости" — только у подкатегории 1').to.include(data.filterSubcategoryOnlyGroupSlug);
                    expect(groups2).to.not.include(data.filterSubcategoryOnlyGroupSlug);
                    expect(groups2, 'группа "Сушка" — только у подкатегории 2').to.include(data.filterSubcategory2OnlyGroupSlug);
                    expect(groups1).to.not.include(data.filterSubcategory2OnlyGroupSlug);
                });
            });

            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
            cy.contains('Сбор жидкости').should('be.visible');
            cy.contains('Сушка').should('not.exist');

            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategory2Slug}`);
            cy.contains('Сушка').should('be.visible');
            cy.contains('Сбор жидкости').should('not.exist');
        });

        it('FP-003: подкатегория меняет диапазон цены (min/max), а не только список фильтров', () => {
            getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug).then(({ body: sub1 }) => {
                getCatalogFilters(data.filterSubcategory2Slug, data.filterPromoSlug).then(({ body: sub2 }) => {
                    expect(sub1.priceRange.minPrice).to.not.eq(sub2.priceRange.minPrice);
                    expect(sub1.priceRange.maxPrice).to.not.eq(sub2.priceRange.maxPrice);

                    Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
                    Detail.priceRangeInputs.eq(0).invoke('val').then((val) => {
                        const min = Number(val.replace(/\s/g, ''));
                        expect(min).to.eq(sub1.priceRange.minPrice);
                    });
                });
            });
        });

        it('FP-004: клик по иконке УЖЕ активной родительской категории сбрасывает категорию целиком (не просто до родителя)', () => {
            // Проверено разведкой 2026-08-04: пока категория "Техника для дома"
            // визуально активна (её иконка выделена рамкой, т.к. текущая
            // подкатегория — её потомок), её href ведёт НЕ на "?category=tehnika-dlya-doma",
            // а на страницу акции ВООБЩЕ БЕЗ категории — т.е. клик по уже
            // активной категории полностью снимает выбор (симметрично тому, что
            // категория в каталоге акций — тоже переключатель, а не однонаправленный выбор)
            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
            cy.contains('Подкатегории').should('be.visible');

            Detail.interceptCatalogFilter();
            Detail.categoryIcons.contains(data.filterCategoryName).click();
            Detail.waitCatalogFilter().then((interception) => {
                cy.url().should('not.include', 'category=');
                expect(interception.response.body.totalCount).to.be.greaterThan(0);
            });
            cy.contains('Подкатегории').should('not.exist');
        });

        it('FP-005: переключение между двумя подкатегориями (через родительскую категорию) — набор групп/цена каждой соответствуют именно ей', () => {
            // Виджет "Подкатегории" всегда показывает ДЕТЕЙ ТЕКУЩЕЙ категории —
            // находясь внутри подкатегории 1, соседнюю подкатегорию 2 напрямую не
            // выбрать (см. detailPage.clickSubcategoryByName) — нужно вернуться к
            // родителю через хлебную крошку
            Detail.visit(data.filterPromoSlug, `?category=${data.filterCategorySlug}`);
            Detail.interceptCatalogFilter();
            Detail.clickSubcategoryByName(data.filterSubcategoryName);
            Detail.waitCatalogFilter();
            cy.contains('Сбор жидкости').should('be.visible');

            Detail.interceptCatalogFilter();
            Detail.clickCategoryBreadcrumb(data.filterCategoryName);
            Detail.waitCatalogFilter();

            Detail.interceptCatalogFilter();
            Detail.clickSubcategoryByName(data.filterSubcategory2Name);
            Detail.waitCatalogFilter().then((interception) => {
                cy.url().should('include', `category=${data.filterSubcategory2Slug}`);
                expect(interception.response.body.properties.map((p) => p.slug)).to.include(data.filterSubcategory2OnlyGroupSlug);
            });
            cy.contains('Сушка').should('be.visible');
            cy.contains('Сбор жидкости').should('not.exist');
        });
    });

    describe('Один фильтр', () => {

        it('FP-010: выбор одного значения фильтра и клик «Показать N» — URL и число товаров совпадают с API', () => {
            getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: [data.filterBrand1Slug] })
                .then(({ body }) => {
                    const expectedCount = body.totalCount;
                    expect(expectedCount, 'фикстура должна давать >0 результатов').to.be.greaterThan(0);

                    Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
                    Detail.clickFilterValueCheckbox('Бренд', data.filterBrand1Name);

                    Detail.interceptCatalogProducts();
                    Detail.clickApplyFiltersWithCount();
                    Detail.waitCatalogProducts().then((interception) => {
                        cy.url().should('include', `properties[brend][]=${data.filterBrand1Slug}`);
                        expect(interception.response.body.meta.totalCount).to.eq(expectedCount);
                    });
                });
        });

        it('FP-011: счётчик у значения ДО применения совпадает с числом товаров ПОСЛЕ применения', () => {
            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
            Detail.getFilterValueCount('Бренд', data.filterBrand1Name).then((text) => {
                const displayedCount = Number(text.replace(/\D+/g, ''));
                expect(displayedCount).to.be.greaterThan(0);

                Detail.clickFilterValueCheckbox('Бренд', data.filterBrand1Name);
                Detail.interceptCatalogProducts();
                Detail.clickApplyFiltersWithCount();
                Detail.waitCatalogProducts().then((interception) => {
                    expect(interception.response.body.meta.totalCount).to.eq(displayedCount);
                });
            });
        });
    });

    describe('Несколько фильтров: логика И/ИЛИ', () => {

        it('FP-020: два бренда в ОДНОЙ группе — логика ИЛИ, итоговый count = сумма (без пересечения)', () => {
            getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: [data.filterBrand1Slug] }).then(({ body: b1 }) => {
                getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: [data.filterBrand2Slug] }).then(({ body: b2 }) => {
                    getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: [data.filterBrand1Slug, data.filterBrand2Slug] }).then(({ body: both }) => {
                        expect(both.totalCount, 'ИЛИ внутри группы: sum(бренд1, бренд2) без пересечения').to.eq(b1.totalCount + b2.totalCount);

                        Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
                        Detail.clickFilterValueCheckbox('Бренд', data.filterBrand1Name);
                        Detail.clickFilterValueCheckbox('Бренд', data.filterBrand2Name);
                        Detail.interceptCatalogProducts();
                        Detail.clickApplyFiltersWithCount();
                        Detail.waitCatalogProducts().then((interception) => {
                            expect(interception.response.body.meta.totalCount).to.eq(both.totalCount);
                        });
                    });
                });
            });
        });

        it('FP-021: фильтры из РАЗНЫХ групп (бренд + «Есть скидка») — логика И, итоговый count строго меньше каждого из них', () => {
            // Samsung(10) + скидка(68) → 2 — доказательный пример: результат
            // строго меньше ОБОИХ фильтров по отдельности (brend=tefal здесь не
            // подошёл бы — у него ВСЕ товары со скидкой, count не меняется)
            getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: ['samsung'] }).then(({ body: brandOnly }) => {
                getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { discount: [data.filterDiscountValueSlug] }).then(({ body: discountOnly }) => {
                    getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: ['samsung'], discount: [data.filterDiscountValueSlug] }).then(({ body: both }) => {
                        expect(both.totalCount).to.be.lessThan(brandOnly.totalCount);
                        expect(both.totalCount).to.be.lessThan(discountOnly.totalCount);

                        Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
                        Detail.clickFilterValueCheckbox('Бренд', 'Samsung');
                        Detail.clickFilterValueCheckbox('Есть скидка', data.filterDiscountValueName);
                        Detail.interceptCatalogProducts();
                        Detail.clickApplyFiltersWithCount();
                        Detail.waitCatalogProducts().then((interception) => {
                            expect(interception.response.body.meta.totalCount).to.eq(both.totalCount);
                            cy.url().should('include', 'properties[brend][]=samsung').and('include', `properties[discount][]=${data.filterDiscountValueSlug}`);
                        });
                    });
                });
            });
        });

        // Сверяем ОБА порядка клика с одним и тем же независимым API-эталоном, а
        // не друг с другом напрямую, и КАЖДЫЙ порядок — в СВОЁМ отдельном it():
        // при попытке проверить оба порядка внутри одного теста повторный
        // cy.visit() на том же alias '@catalogProducts' ловит гонку — его
        // собственный начальный неотфильтрованный запрос неотличим по времени
        // от запроса, порождённого клавишей «Показать» (см. установленный по
        // всему файлу паттерн: разные кейсы — разные it(), а не цепочка visit'ов).
        it('FP-022a: бренд→скидка — итоговый count совпадает с независимым API-эталоном', () => {
            getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: ['samsung'], discount: [data.filterDiscountValueSlug] })
                .then(({ body: expected }) => {
                    Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
                    Detail.clickFilterValueCheckbox('Бренд', 'Samsung');
                    Detail.clickFilterValueCheckbox('Есть скидка', data.filterDiscountValueName);
                    Detail.interceptCatalogProducts();
                    Detail.clickApplyFiltersWithCount();
                    Detail.waitCatalogProducts().then((interception) => {
                        expect(interception.response.body.meta.totalCount).to.eq(expected.totalCount);
                        cy.url().should('include', 'properties[brend][]=samsung').and('include', `properties[discount][]=${data.filterDiscountValueSlug}`);
                    });
                });
        });

        it('FP-022b: скидка→бренд (обратный порядок) — тот же итоговый count, что и в FP-022a', () => {
            getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: ['samsung'], discount: [data.filterDiscountValueSlug] })
                .then(({ body: expected }) => {
                    Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
                    Detail.clickFilterValueCheckbox('Есть скидка', data.filterDiscountValueName);
                    Detail.clickFilterValueCheckbox('Бренд', 'Samsung');
                    Detail.interceptCatalogProducts();
                    Detail.clickApplyFiltersWithCount();
                    Detail.waitCatalogProducts().then((interception) => {
                        expect(interception.response.body.meta.totalCount).to.eq(expected.totalCount);
                        cy.url().should('include', 'properties[brend][]=samsung').and('include', `properties[discount][]=${data.filterDiscountValueSlug}`);
                    });
                });
        });
    });

    describe('3+ фильтра и пересечения', () => {

        it('FP-030: 3 фильтра из разных групп дают именно пересечение — сверка списка товаров с прямым API-запросом', () => {
            getCatalogProducts(data.filterSubcategorySlug, data.filterPromoSlug, {
                properties: { brend: ['samsung'], discount: [data.filterDiscountValueSlug], promotion: ['recommendations'] },
            }).then(({ body: expected }) => {
                expect(expected.meta.totalCount, 'фикстура должна давать >0 результатов').to.be.greaterThan(0);
                const expectedIds = expected.products.map((p) => p.id).sort();

                Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
                Detail.clickFilterValueCheckbox('Бренд', 'Samsung');
                Detail.clickFilterValueCheckbox('Есть скидка', data.filterDiscountValueName);
                Detail.clickFilterValueCheckbox('Специальные предложения', 'Подборки и рекомендации');
                Detail.interceptCatalogProducts();
                Detail.clickApplyFiltersWithCount();
                Detail.waitCatalogProducts().then((interception) => {
                    const actualIds = interception.response.body.products.map((p) => p.id).sort();
                    expect(actualIds).to.deep.eq(expectedIds);
                });
            });
        });

        it('FP-031 / БАГ: 2+ валидных, но взаимоисключающих фильтра (пересечение = 0) — фронт должен показать «не найдено», а не зависнуть', () => {
            // См. BugReport/Акции/BUG-004: backend отвечает 204 (это ВАЛИДНЫЙ
            // ответ backend'а для пустого результата), но фронт никогда не
            // выходит из состояния загрузки. Тест целенаправленно проверяет
            // ОЖИДАЕМОЕ поведение и падает, документируя баг.
            getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: [data.filterZeroIntersectionBrandSlug] })
                .then(({ body }) => {
                    const discountItem = findFilterItem(body, data.filterDiscountGroupSlug, data.filterDiscountValueSlug);
                    expect(discountItem?.count, 'фикстура должна давать пересечение 0 для этой пары').to.eq(0);
                });

            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}&properties[brend][]=${data.filterZeroIntersectionBrandSlug}&properties[discount][]=${data.filterDiscountValueSlug}`);
            cy.contains(/не найден|ничего не найдено|нет результатов/i, { timeout: 10000 }).should('be.visible');
        });

        it('FP-032: после применения 2 фильтров в других группах ещё остаются доступные (не обнулённые) значения', () => {
            getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: ['samsung'], discount: [data.filterDiscountValueSlug] })
                .then(({ body }) => {
                    const promotionGroup = body.properties.find((p) => p.slug === 'promotion');
                    const availableValues = promotionGroup.items.filter((i) => i.count > 0);
                    expect(availableValues.length, 'должно остаться хотя бы одно доступное значение в другой группе').to.be.greaterThan(0);

                    Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}&properties[brend][]=samsung&properties[discount][]=${data.filterDiscountValueSlug}`);
                    // Доступное значение (count>0) НЕ задизейблено ("Специальные
                    // предложения" свёрнута по умолчанию — assertFilterValueEnabled
                    // сама раскрывает группу перед проверкой)
                    Detail.assertFilterValueEnabled('Специальные предложения', availableValues[0].value);
                });
        });
    });

    describe('Недоступные (обнулённые) фильтры', () => {

        it('FP-040: выбор одного значения обнуляет несовместимые значения в других группах ещё ДО клика «Показать» (живой пересчёт)', () => {
            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);

            Detail.interceptCatalogFilter();
            Detail.clickFilterValueCheckbox('Бренд', data.filterZeroIntersectionBrandName);
            Detail.waitCatalogFilter().then((interception) => {
                const discountItem = findFilterItem(interception.response.body, data.filterDiscountGroupSlug, data.filterDiscountValueSlug);
                expect(discountItem.count, 'счётчик пересчитан вживую ДО клика «Показать»').to.eq(0);
            });
            // Скоуп через _groupContainer обязателен — на странице есть и другие
            // группы с бинарными значениями "Да"/"Нет" (например "Турбощётка в
            // комплекте"), глобальный cy.contains('label', 'Да') мог бы найти не ту
            Detail.assertFilterValueCountText('Есть скидка', data.filterDiscountValueName, '0');
        });

        it('FP-041: клик по значению фильтра со счётчиком 0 заблокирован (нативный disabled на чекбоксе)', () => {
            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
            Detail.clickFilterValueCheckbox('Бренд', data.filterZeroIntersectionBrandName);
            Detail.assertFilterValueDisabled('Есть скидка', data.filterDiscountValueName);
            // Клик по задизейбленному чекбоксу не должен применяться — URL после
            // «Показать» не должен содержать discount, т.к. чекбокс не переключился
            Detail.interceptCatalogProducts();
            Detail.clickApplyFiltersWithCount();
            Detail.waitCatalogProducts().then(() => {
                cy.url().should('not.include', 'properties[discount]');
            });
        });

        it('FP-042: снятие конфликтующего фильтра возвращает первоначальный (ненулевой) счётчик', () => {
            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
            Detail.getFilterValueCount('Есть скидка', data.filterDiscountValueName).then((initialText) => {
                const initialCount = Number(initialText.replace(/\D+/g, ''));
                expect(initialCount).to.be.greaterThan(0);

                Detail.interceptCatalogFilter();
                Detail.clickFilterValueCheckbox('Бренд', data.filterZeroIntersectionBrandName);
                Detail.waitCatalogFilter();
                Detail.assertFilterValueDisabled('Есть скидка', data.filterDiscountValueName);

                // Снимаем бренд обратно (повторный клик по тому же чекбоксу)
                Detail.interceptCatalogFilter();
                Detail.clickFilterValueCheckbox('Бренд', data.filterZeroIntersectionBrandName);
                Detail.waitCatalogFilter().then((interception) => {
                    const discountItem = findFilterItem(interception.response.body, data.filterDiscountGroupSlug, data.filterDiscountValueSlug);
                    expect(discountItem.count).to.eq(initialCount);
                });
            });
        });
    });

    describe('Нестандартные комбинации', () => {

        it('FP-050: смена подкатегории (через родителя) при уже применённых фильтрах сбрасывает их (группа фильтров сама по себе меняется)', () => {
            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}&properties[brend][]=${data.filterBrand1Slug}`);
            cy.url().should('include', 'properties[brend]');

            Detail.interceptCatalogFilter();
            Detail.clickCategoryBreadcrumb(data.filterCategoryName);
            Detail.waitCatalogFilter();

            Detail.interceptCatalogFilter();
            Detail.clickSubcategoryByName(data.filterSubcategory2Name);
            Detail.waitCatalogFilter().then(() => {
                cy.url().should('include', `category=${data.filterSubcategory2Slug}`).and('not.include', 'properties[brend]');
            });
        });

        it('FP-051: сортировка сохраняется при применении фильтра (в отличие от каталога акций, где фильтр сбрасывает sortBy — см. COMBO-001)', () => {
            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
            Detail.clickSort('Сначала подешевле');
            cy.url().should('include', 'sort');

            Detail.clickFilterValueCheckbox('Бренд', data.filterBrand1Name);
            Detail.interceptCatalogProducts();
            Detail.clickApplyFiltersWithCount();
            Detail.waitCatalogProducts().then(() => {
                cy.url().should('include', 'sort').and('include', `properties[brend][]=${data.filterBrand1Slug}`);
            });
        });

        it('FP-052: список значений в группе «Бренд» пересортировывается по count при выборе фильтра в другой группе (ищем по тексту, не по индексу)', () => {
            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);

            Detail.interceptCatalogFilter();
            Detail.clickFilterValueCheckbox('Есть скидка', data.filterDiscountValueName);
            Detail.waitCatalogFilter().then((interception) => {
                const brandGroup = interception.response.body.properties.find((p) => p.slug === 'brend');
                const counts = brandGroup.items.map((i) => i.count);
                const sortedDesc = [...counts].sort((a, b) => b - a);
                expect(counts, 'список брендов отсортирован по убыванию count после пересчёта').to.deep.eq(sortedDesc);
            });
        });

        // Примечание: изначальный план предполагал здесь поиск внутри развёрнутого
        // списка "Показать все" (FP-053 из TestPlans/FP-filters-subcategories-testplan.md).
        // Разведкой 2026-08-04 установлено: этот конкретный виджет реагирует
        // ТОЛЬКО на реальные (isTrusted) события мыши — ни Cypress .click(),
        // ни ручной dispatchEvent тех же событий его не открывают (проверено
        // напрямую через javascript_exec с полной последовательностью pointerdown/
        // mousedown/pointerup/mouseup/click — эффекта нет), хотя настоящий клик
        // через расширение браузера открывает его мгновенно. Это ограничение
        // среды автотеста, а не баг сайта (аналогично нерендерящейся пагинации
        // в catalog.cy.js) — поэтому кейс заменён на другой нестандартный сценарий
        // из той же категории "быстрые повторные действия", не зависящий от этого виджета.
        it('FP-053: двойной клик по чекбоксу фильтра регистрируется как ОДНО переключение, а не два (защита от дребезга), и корректно применяется', () => {
            // Проверено фактически: пара кликов внутри одного dblclick НЕ
            // нейтрализует друг друга (чек→снятие), а даёт то же самое, что и
            // один клик (чек) — компонент, судя по всему, игнорирует второй
            // click-эвент того же dblclick-жеста. Это разумная защита от
            // случайного двойного клика, а не баг — фиксируем факт и проверяем,
            // что итоговое состояние (один выбранный бренд) применяется корректно.
            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);
            cy.contains('label', data.filterBrand1Name)
                .closest('[data-slot="root"]')
                .find('button[role="checkbox"]')
                .as('brandCheckbox')
                .should('have.attr', 'data-state', 'unchecked');

            cy.get('@brandCheckbox').dblclick({ force: true });
            cy.get('@brandCheckbox').should('have.attr', 'data-state', 'checked');

            Detail.interceptCatalogProducts();
            Detail.clickApplyFiltersWithCount();
            Detail.waitCatalogProducts().then((interception) => {
                cy.url().should('include', `properties[brend][]=${data.filterBrand1Slug}`);
                getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: [data.filterBrand1Slug] }).then(({ body }) => {
                    expect(interception.response.body.meta.totalCount).to.eq(body.totalCount);
                });
            });
        });

        it('FP-054 / БАГ: прямой переход по URL с невалидным значением фильтра не должен ломать страницу', () => {
            // См. BugReport/Акции/BUG-004: backend отвечает 204 на несуществующее
            // значение бренда (валидный ответ), но фронт зависает в бесконечной
            // загрузке карточек товаров вместо пустого состояния
            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}&properties[brend][]=${data.filterInvalidBrandSlug}`);
            cy.get('body').should('be.visible');
            cy.contains(/не найден|ничего не найдено|нет результатов/i, { timeout: 10000 }).should('be.visible');
        });

        it('FP-055: быстрое переключение нескольких чекбоксов подряд — итоговое состояние соответствует последнему набору, а не гонке промежуточных пересчётов', () => {
            Detail.visit(data.filterPromoSlug, `?category=${data.filterSubcategorySlug}`);

            // Кликаем 3 чекбокса подряд без ожидания между кликами — эмулируем
            // гонку запросов /catalog/filter, которую пользователь создаёт быстрым кликаньем
            Detail.clickFilterValueCheckbox('Бренд', data.filterBrand1Name);
            Detail.clickFilterValueCheckbox('Бренд', data.filterBrand2Name);
            Detail.clickFilterValueCheckbox('Бренд', data.filterBrand1Name); // снимаем обратно

            Detail.interceptCatalogProducts();
            Detail.clickApplyFiltersWithCount();
            Detail.waitCatalogProducts().then((interception) => {
                // В итоге должен остаться выбранным только бренд2 (последнее
                // консистентное состояние: brand1 включили и тут же выключили)
                cy.url().should('include', `properties[brend][]=${data.filterBrand2Slug}`).and('not.include', `properties[brend][]=${data.filterBrand1Slug}`);
                getCatalogFilters(data.filterSubcategorySlug, data.filterPromoSlug, { brend: [data.filterBrand2Slug] }).then(({ body }) => {
                    expect(interception.response.body.meta.totalCount).to.eq(body.totalCount);
                });
            });
        });
    });
});
