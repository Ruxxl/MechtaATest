// Page Object для раздела "Уценённые товары" (Уцененные_товары_тест_кейсы.xlsx,
// 21 лист, 364 кейса — см. TestPlans/Defectives-full-testcases.md).
// Разведка 2026-08-06: навигационный текст в каталоге БЕЗ буквы "ё" — "Уцененные
// товары" (не "Уценённые"). Роут /defected/. Категория товаров — /section/
// defective-{slug}/ (префикс "defective-" перед обычным slug категории).
//
// Ключевые эндпоинты:
// - GET /api/v3/product/{slug}/defectives -> {product, defectives:[{slug, images,
//   name, defectType, defectDetails[], componentsState, packageState,
//   prices{basePrice,finalPrice}, subdivision{address,schedule,stock,
//   stockProgress,onlyShopwindow,latitude,longitude}}]} — модалка "Выберите
//   уцененный товар". С РОДИТЕЛЬСКОЙ (обычной) страницы товара показывает ВСЕ
//   единицы; с любой ИЗ САМИХ уценённых единиц — все, КРОМЕ себя самой.
// - GET /api/v3/product/{slug} для самой уценённой единицы содержит
//   productType="DefectiveProductType" и defectiveDetails{baseProductSlug,
//   serialNumber,packageState,defectType,details[],componentsState} — ВАЖНО:
//   поле называется "details" здесь, а НЕ "defectDetails" как в /defectives —
//   разные DTO для одной и той же концепции, не приводить к одному имени вслепую.
// - Адрес нахождения экземпляра — это /subdivisions (тот же эндпоинт, что и у
//   обычных товаров), просто с stock="Уценка" вместо обычных значений.
//
// НАЙДЕНО РАЗВЕДКОЙ (кандидат в баг, см. BugReport/Товар/defectives_product/):
// раскрытый блок "Причина уценки" в модалке показывает ТОЛЬКО Состояние
// (defectType) / Упаковка (packageState) / Комплект (componentsState) / Адрес —
// поле "Дефекты" (defectDetails[], конкретное описание типа "Царапины на
// корпусе") НИГДЕ в модалке не отображается, хотя API его отдаёт и хотя на
// самой странице уценённого товара оно ЕСТЬ отдельной строкой "Дефекты".
import productPage from './product_page';

const ProductPage = new productPage();

class defectiveProduct {

    // --- Каталог: раздел "Уценённые товары" (TC-001..003) ---
    openCatalogMenu() {
        cy.contains('button', 'Каталог').click();
    }

    // Текст в каталоге БЕЗ буквы "ё" — см. разведку выше
    get defectedCatalogMenuItem() {
        return cy.contains('Уцененные товары');
    }

    clickDefectedCatalogMenuItem() {
        this.defectedCatalogMenuItem.click();
    }

    visitDefectedLanding() {
        cy.visit('/defected/');
    }

    get howItWorksBlock() {
        return cy.contains('Как это работает');
    }

    categoryTile(name) {
        return cy.contains(name);
    }

    clickCategoryTile(name) {
        this.categoryTile(name).click();
    }

    // --- Список уценённых товаров (TC-004..006) ---
    get discountTypeFilterHeading() {
        return cy.contains('Вид уценки');
    }

    get componentsFilterHeading() {
        return cy.contains('Комплект');
    }

    get packageFilterHeading() {
        return cy.contains('Упаковка');
    }

    get emptyResultsMessage() {
        return cy.contains(/товары не найдены/i);
    }

    // --- Карточка/страница товара: кнопка "Уцененный" и модалка выбора (TC-007..017) ---
    interceptDefectives() {
        cy.intercept('GET', '**/api/v3/product/*/defectives').as('defectives');
    }

    waitDefectives() {
        return cy.wait('@defectives', { timeout: 20000 });
    }

    // Пилюля "Уцененный N" ("Арзандатылған N" на казахской /kk/ локали) рядом с
    // "Новый" в блоке "Состояние: ..." на странице ОБЫЧНОГО товара, у которого
    // есть доступные уценённые аналоги — локатор учитывает оба языка сайта
    get defectiveTriggerButton() {
        return cy.contains('button', /Уцененный|Арзандатылған/);
    }

    assertDefectiveTriggerNotShown() {
        cy.contains('button', /Уцененный|Арзандатылған/).should('not.exist');
    }

    clickDefectiveTrigger() {
        this.defectiveTriggerButton.click();
    }

    get defectiveModal() {
        return cy.contains('Выберите уцененный товар').closest('[role="dialog"], div').parents().eq(2);
    }

    // Модалка НЕ имеет role="dialog" (тот же паттерн, что и панель сопутки в
    // product_page/cart_crosssell.cy.js) — скоуп через заголовок
    get defectiveModalHeading() {
        return cy.contains('Выберите уцененный товар');
    }

    assertDefectiveModalShown() {
        this.defectiveModalHeading.should('be.visible');
    }

    assertDefectiveModalNotShown() {
        cy.contains('Выберите уцененный товар').should('not.exist');
    }

    // ВАЖНО: cy.contains(selector, text) возвращает только ПЕРВОЕ совпадение в DOM
    // (см. skill п.4, уже не раз ловившая эту же ошибку в проекте) — .eq(index) на
    // таком результате всегда падает для index > 0. Правильно — cy.get() ВСЕХ
    // кнопок, затем .filter() по тексту, и уже потом .eq(index).
    // Регекс учитывает и русскую, и казахскую (/kk/) локали — см. TC-018
    defectiveReasonToggle(index) {
        return cy.get('button')
            .filter((i, el) => /Причина уценки|Скрыть|Жеңілдік себебі|Жасыру/.test(el.textContent.trim()) && el.getBoundingClientRect().width > 0)
            .eq(index);
    }

    toggleDefectiveReason(index) {
        this.defectiveReasonToggle(index).click();
    }

    assertDefectiveReasonExpanded(index) {
        this.defectiveReasonToggle(index).should('contain.text', 'Скрыть');
    }

    assertDefectiveReasonCollapsed(index) {
        this.defectiveReasonToggle(index).should('contain.text', 'Причина уценки');
    }

    selectDefectiveModalItem(index) {
        cy.get('button').filter((i, el) => el.textContent.trim() === 'Выбрать' && el.getBoundingClientRect().width > 0).eq(index).click();
    }
}

export default defectiveProduct;
export { ProductPage };
