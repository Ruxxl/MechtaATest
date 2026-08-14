// Page Object для страницы категории каталога /section/{slug}/ (например
// /section/planshety/ — "Планшеты"). НЕ путать с cypress/support/pageObjects/
// actions/detailPage.js — это другая страница (детальная страница акции
// /useful/shares/{slug}/), хоть виджеты фильтра визуально похожи и во многом
// используют тот же паттерн кастомных компонентов (аккордеон групп, кастомный
// чекбокс <button role="checkbox">).
//
// Ключевые факты, подтверждённые живой разведкой 2026-08-11 (браузер + прямые
// запросы к API) на /section/planshety/:
// - Группы фильтров — аккордеон на Reka UI (id="reka-accordion-trigger-*"),
//   каждая — <button aria-expanded="true|false">; часть групп открыта по
//   умолчанию (Бренд, Есть скидка), часть свёрнута (всё остальное).
// - Клик по чекбоксу НЕ переходит по URL сразу: сначала "вживую" пересчитывает
//   соседние счётчики и диапазон цены через повторный GET /catalog/filter,
//   показывает кнопку "Показать N результатов" — реальный переход с
//   query-параметрами properties[group][]=value происходит только по клику
//   на эту кнопку (тот же паттерн, что и в defective_product.js).
// - "Показать все" у больших групп (Линейка — 37 значений, Модель процессора —
//   29) открывает встроенный <input placeholder="Поиск"> + прокручиваемый
//   список ВСЕХ значений (не только видимых) — но САМ клик по "Показать все"
//   не реагирует на программные клики Cypress (ни .click(), ни {force:true}),
//   тот же класс проблемы, что уже задокументирован в
//   feedback_cypress_untrusted_click_limitation для аналогичного виджета на
//   /useful/shares/{slug}/. Подтверждено повторно живым пробным тестом
//   2026-08-11. Значения "за раскрытием" по-прежнему реально применимы через
//   URL (deep-link) — тесты используют это как эквивалент проверки поиска.
// - "Наличие в магазине" — отдельный тип виджета (API: type="dropdown"),
//   визуально комбобокс <button role="combobox">"Все магазины"</button> +
//   <div role="option">. В отличие от "Показать все", ЭТОТ комбобокс
//   реагирует на программные клики Cypress нормально (проверено).
// - Цена: слайдер-хэндлы и чипы-пресеты ("до 270 890 ₸") НЕ реагируют на
//   программные клики (тот же класс, см. defectives price_checks.cy.js), НО
//   сами текстовые поля "От"/"До" — обычные <input>, ввод текста в них
//   работает и тоже показывает кнопку "Показать N результатов"; после клика
//   URL получает отдельные (не properties[...]) параметры minPrice/maxPrice.
// cy.contains(selector, text) матчит ПОДСТРОКУ — "Наличие" совпадает и с
// "Наличие в магазине" (который стоит раньше в DOM), из-за чего клик по
// заголовку "Наличие" реально попадал в "Наличие в магазине". Точный матч
// через якорный regex — единственный надёжный способ отличить их.
function exactText(text) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^\\s*${escaped}\\s*$`);
}

class SectionCatalogPage {

    visit(slug, queryString = '') {
        cy.visit(`/section/${slug}/${queryString}`);
    }

    interceptCatalogFilter() {
        cy.intercept('GET', 'https://www.mechta.kz/api/v3/catalog/filter**').as('catalogFilter');
    }
    waitCatalogFilter() { return cy.wait('@catalogFilter'); }

    interceptCatalogProducts() {
        cy.intercept('GET', 'https://www.mechta.kz/api/v3/catalog/products**').as('catalogProducts');
    }
    waitCatalogProducts() { return cy.wait('@catalogProducts'); }

    get totalCountHeading() {
        return cy.contains(/^\d+\s+товар/);
    }

    // Уникальные ссылки на карточки товаров, реально ОТРИСОВАННЫЕ на
    // странице (каждая карточка обычно даёт 2-3 <a href="/product/...">:
    // картинка/название/кнопка) — используется, чтобы сверить не только
    // totalCount из сетевого ответа, но и фактический рендер. Подтверждено
    // живой разведкой 2026-08-11: на /section/personalnye-kompyutery/
    // ?properties[brend][]=xg unique-count (10) точно совпал с totalCount API.
    // ВАЖНО: скоуп через 'body' + jQuery .find(), а не голый cy.get(selector)
    // — у cy.get() с нулём совпадений нет "спокойного" пути вернуть пустой
    // массив, он ретраит и падает с "never found it"; это ломает ровно тот
    // случай, ради которого метод чаще всего и нужен — пустая выдача (0
    // карточек) после сужающего фильтра/нерелевантной страницы пагинации.
    getRenderedProductSlugs() {
        return cy.get('body').then(($body) => {
            const hrefs = [...$body[0].querySelectorAll('a[href^="/product/"]')].map((el) => el.getAttribute('href'));
            return [...new Set(hrefs)];
        });
    }

    // Retry-способная версия для случаев, когда карточки ещё не успели
    // отрисоваться сразу после того, как сетевой ответ перехвачен (сетевой
    // wait ловит МОМЕНТ ответа, а не момент рендера) — обнаружено 2026-08-11:
    // `getRenderedProductSlugs().should('have.length', N)` для N > 0 иногда
    // ловил 0 сразу после applyFiltersWithCount (простой .then() внутри
    // getRenderedProductSlugs не переигрывается так же надёжно, как
    // `.should(callback)` — а вот сценарий N === 0 (пустая выдача) через
    // getRenderedProductSlugs проходил стабильно, поэтому тот метод остаётся
    // как есть для этого случая). Здесь — офиц. retry-безопасная форма
    // Cypress: `.should(callback)` переигрывает ВЕСЬ callback, пока он не
    // перестанет бросать/не истечёт таймаут.
    assertRenderedProductCount(expectedCount) {
        cy.get('body', { timeout: 15000 }).should(($body) => {
            const hrefs = [...$body[0].querySelectorAll('a[href^="/product/"]')].map((el) => el.getAttribute('href'));
            expect([...new Set(hrefs)]).to.have.length(expectedCount);
        });
    }

    // Универсальный контейнер группы фильтра — тот же подход, что и в
    // detailPage.js: поднимаемся от заголовка вверх, пока не найдём внутри
    // хотя бы один чекбокс, предварительно раскрывая аккордеон, если свёрнут.
    _groupContainer(groupHeading) {
        return cy.contains('button', exactText(groupHeading)).then(($btn) => {
            if ($btn.attr('aria-expanded') === 'false') {
                cy.wrap($btn).click();
            }
        }).then(() => cy.contains('span,div,button,h2,h3', exactText(groupHeading))).then(($heading) => {
            let el = $heading[0];
            while (el && !el.querySelector('button[role="checkbox"]') && el !== document.body) {
                el = el.parentElement;
            }
            return cy.wrap(el);
        });
    }

    clickFilterValueCheckbox(groupHeading, valueLabel) {
        this._groupContainer(groupHeading)
            .contains('label', valueLabel)
            .closest('[data-slot="root"]')
            .find('button[role="checkbox"]')
            .click({ force: true });
    }

    getFilterValueCheckbox(groupHeading, valueLabel) {
        return this._groupContainer(groupHeading)
            .contains('label', valueLabel)
            .closest('[data-slot="root"]')
            .find('button[role="checkbox"]');
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
        this.getFilterValueCheckbox(groupHeading, valueLabel).should('be.disabled');
    }

    assertFilterValueEnabled(groupHeading, valueLabel) {
        this.getFilterValueCheckbox(groupHeading, valueLabel).should('not.be.disabled');
    }

    assertFilterValueChecked(groupHeading, valueLabel) {
        this.getFilterValueCheckbox(groupHeading, valueLabel).should('have.attr', 'data-state', 'checked');
    }

    assertFilterValueUnchecked(groupHeading, valueLabel) {
        this.getFilterValueCheckbox(groupHeading, valueLabel).should('have.attr', 'data-state', 'unchecked');
    }

    // Кнопка-триггер аккордеона группы — используется, когда нужно раскрыть/
    // свернуть группу напрямую, без последующего поиска значения внутри
    groupToggle(groupHeading) {
        return cy.contains('button', exactText(groupHeading));
    }

    assertGroupExpanded(groupHeading) {
        this.groupToggle(groupHeading).should('have.attr', 'aria-expanded', 'true');
    }

    assertGroupCollapsed(groupHeading) {
        this.groupToggle(groupHeading).should('have.attr', 'aria-expanded', 'false');
    }

    clickApplyFiltersWithCount() {
        cy.contains('button', /Показать \d+ результат/).click();
    }

    hasApplyButton() {
        return cy.get('body').then(($body) => $body.find('button').filter((i, el) => /Показать\s+\d+\s+результат/.test(el.textContent.trim())).length > 0);
    }

    // Контейнер сайдбара фильтров — сам блок "Цена" + 1 уровень вверх до общего
    // div, внутри которого лежат ВСЕ 22 группы-аккордеона. Обязательно скоупить
    // через него: у футера ("Компания Мечта.kz", "Партнерам") аккордеоны на той
    // же Reka UI библиотеке имеют тот же префикс id "reka-accordion-trigger-*"
    // — плоский cy.get('button[id^="reka-accordion-trigger"]') без скоупа
    // подхватывает и их (подтверждено разведкой 2026-08-11).
    get filterSidebarContainer() {
        return cy.contains('Цена').parents().eq(1);
    }

    // Заголовки ТОЛЬКО групп фильтров (аккордеон-триггеры сайдбара, без футера)
    get filterGroupHeadings() {
        return this.filterSidebarContainer.find('button[id^="reka-accordion-trigger"]').then(($els) => [...$els].map((el) => el.textContent.trim()));
    }

    // --- Цена ---
    get priceInputs() {
        return cy.contains('Цена').parents().eq(2).find('input');
    }

    typePriceRange(min, max) {
        // {enter} на последнем поле обязателен — подтверждено разведкой: без
        // него значение остаётся "введённым", но кнопка "Показать N
        // результатов" не появляется (поле не считается закоммиченным).
        // ИЗВЕСТНОЕ ОГРАНИЧЕНИЕ: если этому вызову предшествовал клик по
        // чекбоксу другого фильтра (живой пересчёт), программный ввод здесь
        // визуально отображается, но не всегда подхватывается финальным
        // запросом — подтверждено, что на реальном сайте (настоящие клики
        // мышью) та же последовательность работает корректно. Используйте
        // deep-link (URL с обоими параметрами сразу) для проверки комбинации
        // "чекбокс + цена", если этот метод вызывается не первым действием на
        // чистой странице — см. planshety_filters_combinations.cy.js.
        this.priceInputs.eq(0).clear().type(String(min));
        this.priceInputs.eq(1).clear().type(`${max}{enter}`);
    }

    // --- "Наличие в магазине" — комбобокс, не чекбокс-список ---
    get storeDropdownTrigger() {
        return cy.contains('button[role="combobox"]', /магазин/i);
    }

    openStoreDropdown() {
        this.storeDropdownTrigger.click({ force: true });
    }

    get storeOptions() {
        return cy.get('[role="option"]');
    }

    selectStoreOptionByIndex(index) {
        this.storeOptions.eq(index).click({ force: true });
    }
}

export default SectionCatalogPage;
