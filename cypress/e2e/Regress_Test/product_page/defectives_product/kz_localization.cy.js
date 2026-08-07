// Лист 21 "Локализация KZ (данные из API)" (KZ-001..014, LANG-001..010) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// Переключение локали на этом сайте — ПРЕФИКС URL (`/kk/...`), подтверждено
// живой разведкой и уже использовалось в TC-018 (Sheet 1). Кнопка-переключатель
// "Кк" в шапке существует (найдена `find`), но клик по ней Cypress'ом не даёт
// видимого эффекта при живой проверке — тот же класс ограничения, что и у
// других кастомных виджетов (см. feedback_cypress_untrusted_click_limitation),
// поэтому LANG-001/002/003/006/010 (сценарии именно КЛИКА по кнопке) не
// автоматизированы — используем прямую навигацию на `/kk/...` URL везде.
//
// НЕ автоматизировано:
// - LANG-001/002/003/006/010 (клик по кнопке-переключателю) — см. выше про
//   untrusted-click; принципиально то же поведение переключения проверено
//   через прямую навигацию на /kk/ во всех тестах ниже
// - KZ-003 (частичный перевод массива defectDetails) — в реальных данных
//   массив всегда состоит из 1 идентичного шаблонного значения, нет живого
//   примера смешения языков внутри массива для проверки
// - KZ-007/012 (мок null/"" для kk-значения конкретного поля) — API
//   действительно локализует defectType на бэкенде (см. находку в
//   KZ-001/002 ниже), но не найдено живого примера MDM-записи с
//   отсутствующим kk-переводом, чтобы промоделировать реалистичный мок
//   fallback-сценария (какая именно часть ответа стала бы null — не ясно
//   без разведки реального ответа backend для такого случая)
// - KZ-010 (источник текста лейблов фильтра "Вид уценки") — требует
//   разведки каталога на /kk/, не проверено в этой сессии
// - KZ-011 (гонка RU/KK при быстром двойном переключении) — сценарий
//   специфичен для КЛИКА по переключателю (не URL-навигации), не
//   воспроизводится тем способом, который здесь используется
// - LANG-005 (одновременность обновления блоков при переключении) — то же,
//   специфично для клика, не для полной навигации (при cy.visit('/kk/...')
//   вся страница обновляется атомарно по определению)
// - LANG-007 (перевод корзины) — пересекается с CART-* (Sheet 16), не
//   переделываем ради языка без нового технического риска
// - LANG-009 (мок задержки/ошибки API при смене локали) — не установлено,
//   что смена локали вообще вызывает отдельный API-запрos (см. находку
//   ниже: перевод статичный, /api/v3/product не меняется по локали)
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const DefectiveProduct = new defectiveProduct();

describe('Уценённые товары: локализация KZ (KZ-001/002/004/005/008/009/013/014/LANG-004/008, представительный набор)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    it('KZ-001/002/013: /api/v3/product ДЕЙСТВИТЕЛЬНО возвращает локализованный defectType при заходе через /kk/ (не статическая фронтовая подмена поверх RU-ответа) — структура ответа (набор полей) при этом идентична', () => {
        cy.intercept('GET', '**/api/v3/product/*').as('productRu');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@productRu', { timeout: 20000 }).then((ruInterception) => {
            const ruBody = ruInterception.response.body;
            expect(ruBody.defectiveDetails.defectType, 'RU-ответ должен быть на русском').to.eq('Товар после ремонта');
            cy.intercept('GET', '**/api/v3/product/*').as('productKk');
            cy.visit(`/kk${fixtures.defectiveUnit.url}`);
            cy.wait('@productKk', { timeout: 20000 }).then((kkInterception) => {
                const kkBody = kkInterception.response.body;
                // Находка (пересматривает изначальное предположение теста):
                // ответ САМОГО API уже приходит на казахском при запросе
                // через /kk/ — значение НЕ совпадает с RU-ответом, значит
                // перевод действительно приходит от backend, а не наложен
                // статическим словарём поверх неизменного RU JSON
                expect(kkBody.defectiveDetails.defectType, 'kk-ответ API должен отличаться от RU — реальная бэкенд-локализация, а не фронтовая подмена').to.not.eq(ruBody.defectiveDetails.defectType);
                // Структура (состав полей, KZ-013) при этом идентична —
                // меняются только языковые значения текстовых полей
                expect(Object.keys(kkBody).sort()).to.deep.eq(Object.keys(ruBody).sort());
                expect(Object.keys(kkBody.defectiveDetails).sort()).to.deep.eq(Object.keys(ruBody.defectiveDetails).sort());
            });
            cy.contains('Жағдайы').should('be.visible');
            cy.contains('Жөндеуден кейін').should('be.visible');
        });
    });

    it('KZ-004: "Комплект"/"Упаковка" переведены на UI (Жинақтылығы/Қаптамасы)', () => {
        cy.visit(`/kk${fixtures.defectiveUnit.url}`);
        cy.contains('Жинақтылығы').should('be.visible');
        cy.contains('Қаптамасы').should('be.visible');
    });

    it('KZ-005: название товара (бренд+модель) остаётся БЕЗ перевода — собственные имена не переводятся', () => {
        cy.visit(`/kk${fixtures.defectiveUnit.url}`);
        cy.contains('h1', 'Смартфон APPLE iPhone 17 Pro Max 256GB (Silver)').should('be.visible');
    });

    it('KZ-008: статические UI-лейблы ("В корзину", кнопки) переведены на казахский на странице уцененного товара', () => {
        cy.visit(`/kk${fixtures.defectiveUnit.url}`);
        cy.contains('button', /Себетке/i).should('be.visible');
    });

    it('KZ-009: специфичные казахские буквы (ә, і, ң, ғ, ү, ұ, қ, ө, һ) отображаются корректно, без replacement-символов/кракозябр', () => {
        cy.visit(`/kk${fixtures.defectiveUnit.url}`);
        cy.contains('Жағдайы').should('be.visible');
        cy.get('body').invoke('text').then((text) => {
            expect(/[әіңғүұқөһ]/.test(text), 'на странице должна встречаться хотя бы одна специфичная казахская буква').to.be.true;
            expect(text).to.not.include('�');
            expect(text).to.not.match(/[?]{2,}/);
        });
    });

    it('LANG-004: язык остаётся казахским после перезагрузки страницы (URL с /kk/ сохраняется)', () => {
        cy.visit(`/kk${fixtures.defectiveUnit.url}`);
        cy.contains('Жағдайы').should('be.visible');
        cy.reload();
        cy.url().should('include', '/kk/');
        cy.contains('Жағдайы').should('be.visible');
    });

    it('LANG-008: локаль kk сохраняется и при переходе на ДРУГУЮ страницу фичи (модалка выбора экземпляра) в той же сессии', () => {
        cy.visit(`/kk${fixtures.regularWithDefectiveVariants.url}`);
        cy.contains('Арзандатылған').should('be.visible');
        DefectiveProduct.clickDefectiveTrigger();
        cy.contains('Арзандатылған тауарды таңдаңыз').should('be.visible');
        cy.url().should('include', '/kk/');
    });
});
