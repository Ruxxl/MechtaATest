import { formatRuDateRange } from '../../helpers/promotionsApi';

// Page Object для детальной страницы акции (/useful/shares/{slug}/).
class DetailPage {

    visit(slug, queryString = '') {
        cy.visit(`/useful/shares/${slug}/${queryString}`);
    }

    interceptCategories() {
        cy.intercept('GET', 'https://www.mechta.kz/api/v3/promotions/*/categories**').as('categories');
    }

    waitCategories() {
        return cy.wait('@categories');
    }

    get breadcrumbs() {
        return cy.get('nav[aria-label="breadcrumb"] li, [class*="breadcrumb" i] li');
    }

    clickCategoryByName(name) {
        cy.contains('a,button', name).first().click();
    }

    // Иконки категорий на детальной странице — это <a>/<button> с картинкой И
    // непустым текстом (названием категории), реально видимые на экране.
    // Просто ":has(img)" ловит лишнее (картинки-ссылки в карточках товаров ниже),
    // а разметка вдобавок дублирует блок для мобильной/десктопной версии —
    // скрытый (0×0) дубль откидываем проверкой реальных размеров
    get categoryIcons() {
        return cy.get('a,button').filter((i, el) => {
            const hasImg = !!el.querySelector('img');
            const hasText = el.textContent.trim().length > 0;
            const rect = el.getBoundingClientRect();
            return hasImg && hasText && rect.width > 0 && rect.height > 0;
        });
    }

    openDetailsModal() {
        cy.contains('a,button', 'Подробнее').click();
    }

    closeDetailsModal() {
        cy.get('body').type('{esc}');
    }

    // Не у каждой акции есть баннерный блок с кнопкой "Подробнее" (подтверждено:
    // "bonusy-za-otzyv" — акция с несколькими категориями — баннера не имеет вообще),
    // поэтому перед открытием модалки проверяем её наличие через jQuery-условие,
    // а не полагаемся на cy.contains(), которая упадёт с таймаутом, если её нет.
    hasDetailsButton() {
        return cy.get('body').then(($body) => $body.find('a:contains("Подробнее"), button:contains("Подробнее")').length > 0);
    }

    // Сверяет диапазон дат в модалке "Подробнее" с данными из API (используется
    // сквозным обходом всех акций — assertBannerDatesMatchApi).
    assertBannerDatesMatchApi(promo) {
        this.openDetailsModal();
        cy.contains(formatRuDateRange(promo.fromDate, promo.toDate)).should('be.visible');
        this.closeDetailsModal();
    }

    // Чекбоксы фильтра — не нативные <input type="checkbox">, а кастомная кнопка
    // <button role="checkbox"> рядом с <label>, оба внутри общего [data-slot="root"]
    clickBrandCheckbox(brandName) {
        cy.contains('label', brandName)
            .closest('[data-slot="root"]')
            .find('button[role="checkbox"]')
            .click({ force: true });
    }

    clickApplyFilters() {
        cy.contains('button', 'Показать').click();
    }

    clickResetFilters() {
        cy.contains('button', 'Сбросить все').click();
    }

    // Реальный DOM (проверено 2026-08-04): триггер сортировки — это
    // <button role="combobox">, открывающий список <div role="option">. Обычный
    // текстовый клик по [class*="sort"] ничего не находит — сначала нужно
    // открыть сам комбобокс
    clickSort(label) {
        cy.get('button[role="combobox"]').first().click();
        cy.get('[role="option"]').contains(label).click();
    }

    // --- Фильтры/подкатегории (FP-*) ---
    // Обнаружено разведкой 2026-08-04: подкатегории — это <a class="router-link...">
    // (Vue Router, клиентская навигация без перезагрузки страницы), переиспользуют
    // query-параметр `category` (см. detailPage.clickCategoryByName/clickSubcategoryByName
    // ведут на один и тот же параметр URL, только на разные его значения).
    // ВАЖНО: список "Подкатегории" всегда показывает ДЕТЕЙ ТЕКУЩЕЙ категории —
    // находясь внутри подкатегории 1, соседнюю подкатегорию 2 через этот виджет
    // не выбрать (её там просто нет), нужно сначала вернуться на уровень
    // родительской категории через хлебную крошку (см. clickCategoryBreadcrumb)
    clickSubcategoryByName(name) {
        cy.contains('Подкатегории').parent().contains('a,button', name).click();
    }

    get subcategoryPills() {
        return cy.contains('Подкатегории').parent().find('a,button').filter((i, el) => el.textContent.trim().length > 0);
    }

    // Клик по названию категории в хлебных крошках — в отличие от иконки категории
    // сверху (которая при повторном клике на УЖЕ активную категорию полностью
    // сбрасывает её, см. FP-004), крошка всегда ведёт именно на ?category=<родитель>
    clickCategoryBreadcrumb(name) {
        cy.get('nav a').contains(name).click();
    }

    // Реальные запросы, которые вызывает фронтенд на этой странице (не /promotions**,
    // как у каталога акций, а отдельный каталожный API)
    interceptCatalogCategory() {
        cy.intercept('GET', 'https://www.mechta.kz/api/v3/catalog/category**').as('catalogCategory');
    }
    waitCatalogCategory() { return cy.wait('@catalogCategory'); }

    // /catalog/filter вызывается ДВАЖДЫ по разным поводам: (1) при заходе на
    // страницу — отдаёт список групп/значений, (2) "вживую" при каждом клике по
    // чекбоксу ДО нажатия «Показать» — пересчитывает счётчики соседних значений
    interceptCatalogFilter() {
        cy.intercept('GET', 'https://www.mechta.kz/api/v3/catalog/filter**').as('catalogFilter');
    }
    waitCatalogFilter() { return cy.wait('@catalogFilter'); }

    // /catalog/products — реальный список товаров; вызывается при заходе на
    // страницу и при клике «Показать N результатов» (это полноценный переход по
    // URL с новыми properties[...][], а не отдельный XHR поверх текущей страницы)
    interceptCatalogProducts() {
        cy.intercept('GET', 'https://www.mechta.kz/api/v3/catalog/products**').as('catalogProducts');
    }
    waitCatalogProducts() { return cy.wait('@catalogProducts'); }

    // Универсальный контейнер группы фильтра — поднимаемся от заголовка вверх,
    // пока не найдём внутри хотя бы один чекбокс (устойчиво к точным именам
    // CSS-классов разметки). Группа-аккордеон может быть СВЁРНУТА по умолчанию
    // (проверено 2026-08-04: "Бренд"/"Есть скидка" открыты сразу, а "Специальные
    // предложения"/"Наличие"/"Сбор жидкости" и т.д. — свёрнуты, data-state="closed")
    // — если так, сначала раскрываем её кликом по заголовку-триггеру.
    _groupContainer(groupHeading) {
        return cy.contains('button', groupHeading).then(($btn) => {
            if ($btn.attr('aria-expanded') === 'false') {
                cy.wrap($btn).click();
            }
        }).then(() => cy.contains('span,div,button,h2,h3', groupHeading)).then(($heading) => {
            let el = $heading[0];
            while (el && !el.querySelector('button[role="checkbox"]') && el !== document.body) {
                el = el.parentElement;
            }
            return cy.wrap(el);
        });
    }

    // ВАЖНО (разведка 2026-08-04): виджет "Показать все" у группы "Бренд"
    // реагирует ТОЛЬКО на настоящие (isTrusted) события мыши — ни cy.click(),
    // ни ручной dispatchEvent той же последовательности событий (pointerdown/
    // mousedown/pointerup/mouseup/click) его не открывают, хотя обычный клик
    // через расширение браузера открывает мгновенно. Это ограничение Cypress
    // для конкретно этого компонента, поэтому все FP-* кейсы намеренно
    // используют только значения фильтров, видимые БЕЗ "Показать все"
    // (Tefal/Dreame/Samsung/Dyson — все входят в топ-5 по умолчанию).
    clickFilterValueCheckbox(groupHeading, valueLabel) {
        this._groupContainer(groupHeading)
            .contains('label', valueLabel)
            .closest('[data-slot="root"]')
            .find('button[role="checkbox"]')
            .click({ force: true });
    }

    getFilterValueCount(groupHeading, valueLabel) {
        return this._groupContainer(groupHeading)
            .contains('label', valueLabel)
            .closest('[data-slot="root"]')
            .invoke('text');
    }

    assertFilterValueCountText(groupHeading, valueLabel, expectedText) {
        this._groupContainer(groupHeading)
            .contains('label', valueLabel)
            .closest('[data-slot="root"]')
            .contains(expectedText);
    }

    assertFilterValueDisabled(groupHeading, valueLabel) {
        this._groupContainer(groupHeading)
            .contains('label', valueLabel)
            .closest('[data-slot="root"]')
            .find('button[role="checkbox"]')
            .should('be.disabled');
    }

    assertFilterValueEnabled(groupHeading, valueLabel) {
        this._groupContainer(groupHeading)
            .contains('label', valueLabel)
            .closest('[data-slot="root"]')
            .find('button[role="checkbox"]')
            .should('not.be.disabled');
    }

    clickApplyFiltersWithCount() {
        cy.contains('button', /Показать \d+ результ/).click();
    }

    // Названия видимых групп фильтров (заголовки аккордеонов слева) — используется
    // для сверки набора групп между категорией и подкатегорией (FP-002)
    get filterGroupHeadings() {
        return cy.get('button').filter((i, el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && !!el.querySelector('svg') && el.textContent.trim().length > 0;
        }).then(($els) => [...$els].map((el) => el.textContent.trim()));
    }

    get priceRangeInputs() {
        return cy.contains('Цена').then(($h) => {
            let el = $h[0];
            while (el && el.querySelectorAll('input').length < 2 && el !== document.body) {
                el = el.parentElement;
            }
            return cy.wrap(el).find('input');
        });
    }
}

export default DetailPage;
