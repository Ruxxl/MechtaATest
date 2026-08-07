import CatalogPage from '../../../support/pageObjects/actions/catalogPage';

const Catalog = new CatalogPage();

// Нестандартные комбинации действий на каталоге акций, которых нет в исходных
// тест-кейсах (CAT-*) — фильтры, сортировка и пагинация применяются не по одной,
// а последовательно в разном порядке. Такие сценарии реальны для пользователя
// (сначала отсортировал, потом сузил список).
describe('Каталог акций: нестандартные комбинации фильтров/сортировки/пагинации', () => {

    let data;
    before(() => {
        cy.fixture('actionsData').then((d) => { data = d; });
    });

    it('COMBO-001: выбор любого фильтра (категория ИЛИ вид акции) поверх сортировки сбрасывает её на дефолтную (ожидаемое поведение)', () => {
        // Подтверждено продуктом: клик по сайдбар-фильтру всегда сбрасывает
        // ранее выбранную сортировку, независимо от того, категория это или
        // вид акции — но сами категория/вид акции корректно комбинируются
        // между собой (см. COMBO-002 и уже существующие CAT-011/CAT-021)
        Catalog.interceptPromotions();
        Catalog.visit('?sortBy=popularity');
        Catalog.waitPromotions();

        Catalog.interceptPromotions();
        Catalog.clickCategoryByName(data.knownCategoryName);
        Catalog.waitPromotions();
        cy.url()
            .should('include', `category=${data.knownCategorySlug}`)
            .and('not.include', 'sortBy');

        // Возвращаем сортировку и проверяем, что вид акции ведёт себя так же
        Catalog.interceptPromotions();
        Catalog.visit(`?sortBy=popularity&category=${data.knownCategorySlug}`);
        Catalog.waitPromotions();

        Catalog.interceptPromotions();
        Catalog.clickTypeByName(data.knownTypeName);
        Catalog.waitPromotions();
        cy.url()
            .should('include', `type=${data.knownTypeCode}`)
            .and('include', `category=${data.knownCategorySlug}`) // категория при этом сохраняется
            .and('not.include', 'sortBy');
    });

    it('COMBO-002: сортировка, выбранная ПОСЛЕ вида акции, применяется и сохраняется', () => {
        Catalog.interceptPromotions();
        Catalog.visit(`?type=${data.knownTypeCode}`);
        Catalog.waitPromotions();

        Catalog.interceptPromotions();
        Catalog.clickSort('Популярные акции');
        Catalog.waitPromotions();
        cy.url()
            .should('include', `type=${data.knownTypeCode}`)
            .and('include', 'sortBy=popularity');
    });

    it('COMBO-003: вид акции с несколькими акциями ("Скидки") → категория — счётчик сверяется с API динамически', () => {
        // По просьбе: берём вид акции побольше (не единственную акцию, как "Кэшбэк"),
        // чтобы у фильтрации по категории внутри него был реальный эффект
        cy.request({
            method: 'GET',
            url: 'https://www.mechta.kz/api/v3/promotions',
            qs: { type: 'discount', category: data.discountCategorySlug },
            headers: { Accept: 'application/json', 'X-City-Code': 'astana' },
        }).then(({ body: expected }) => {
            // Категория для этого кейса подобрана так, чтобы внутри вида акции
            // "Скидки" у неё было НЕНУЛЕВОЕ количество акций — иначе элемент
            // получает pointer-events:none (см. CAT-015/016) и клик не проходит
            expect(expected.meta.totalCount, 'фикстура должна давать >0 результатов').to.be.greaterThan(0);

            Catalog.interceptPromotions();
            Catalog.visit('?type=discount');
            Catalog.waitPromotions();

            Catalog.interceptPromotions();
            Catalog.clickCategoryByName(data.discountCategoryName);
            Catalog.waitPromotions().then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(expected.meta.totalCount);
                cy.contains('a', 'Скидки').invoke('text').should('include', String(expected.meta.totalCount));
            });
        });
    });

    it('COMBO-004: переход на страницу 2, затем смена категории — пагинация сбрасывается на страницу 1', () => {
        Catalog.interceptPromotions();
        Catalog.visit('?page=2');
        Catalog.waitPromotions().its('response.body.meta.currentPage').should('eq', 2);

        Catalog.interceptPromotions();
        Catalog.clickCategoryByName(data.knownCategoryName);
        Catalog.waitPromotions().then((interception) => {
            expect(interception.response.body.meta.currentPage).to.eq(1);
            cy.url().should('not.include', 'page=2');
        });
    });

    it('COMBO-005: переход на страницу 2, затем смена сортировки — номер страницы НЕ сбрасывается (задокументированное поведение)', () => {
        // В отличие от COMBO-004 (смена категории) — здесь сайт остаётся на
        // странице 2, но уже нового порядка сортировки. Само по себе не баг
        // (так делают многие каталоги), но асимметрично по отношению к фильтрам —
        // фиксируем фактическое поведение
        Catalog.interceptPromotions();
        Catalog.visit('?page=2');
        Catalog.waitPromotions();

        Catalog.interceptPromotions();
        Catalog.clickSort('Популярные акции');
        Catalog.waitPromotions().then((interception) => {
            expect(interception.request.url).to.include('page=2');
            expect(interception.request.url).to.include('sortBy=popularity');
            expect(interception.response.body.meta.currentPage).to.eq(2);
        });
    });

    it('COMBO-006: быстрое переключение между двумя категориями подряд без ожидания — в итоге применяется последняя (см. CAT-018)', () => {
        Catalog.interceptPromotions();
        Catalog.visit();
        Catalog.waitPromotions();

        Catalog.interceptPromotions();
        // Кликаем по двум разным категориям подряд, не дожидаясь ответа между кликами —
        // эмулируем гонку запросов, которую пользователь может создать быстрым кликаньем
        cy.contains('a,button', data.knownCategoryName).first().click();
        cy.contains('a,button', data.secondCategoryName).first().click();

        Catalog.waitPromotions().then(() => {
            // В итоге URL должен отражать ПОСЛЕДНИЙ клик, а не первый и не оба сразу
            cy.url().should('include', `category=${data.secondCategorySlug}`).and('not.include', data.knownCategorySlug);
        });
    });

    it('COMBO-007: тройная комбинация сортировка+вид+категория за один прямой URL — все параметры применяются согласованно', () => {
        Catalog.interceptPromotions();
        Catalog.visit(`?sortBy=expiring&type=${data.knownTypeCode}&category=${data.knownCategorySlug}`);
        Catalog.waitPromotions().then((interception) => {
            expect(interception.response.statusCode).to.eq(200);
            const { body } = interception.response;
            // Категория остаётся полным списком (см. INT-017), а "Все" считается
            // по категории, а не по итоговому пересечению (см. API-PR-005)
            expect(body.categories.length).to.be.greaterThan(1);
            cy.contains('a', data.knownTypeName).should('be.visible');
            Catalog.assertSortInactive('Новые');
        });
    });
});
