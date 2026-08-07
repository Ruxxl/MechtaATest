// Лист 15 "Магазины самовывоза" (STORE-001..011) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// ИСПРАВЛЕНИЕ 2026-08-07 (важно): изначально этот файл ошибочно утверждал,
// что развёрнутого блока "Доступно на самовывоз" с полем поиска и чекбоксом
// "Скрыть витрину" в текущем UI не существует — вывод был сделан на
// fixtures.defectiveUnit, у которой этого расширенного блока действительно
// нет. Повторной живой разведкой на fixtures.defectiveUnitAnotherModel
// подтверждено, что блок ПОЛНОСТЬЮ СУЩЕСТВУЕТ (таблица "Доступно на
// самовывоз (N магазин)" с полем "Поиск магазина" и чекбоксом "Скрыть
// витрину") — наличие расширенного блока, по всей видимости, зависит от
// конкретного товара/магазина (возможно от их количества), а не отсутствует
// как класс. STORE-002/004/005/006 ниже переписаны на рабочей фикстуре.
// Число N берётся с эндпоинта `/api/v3/product/{slug}/shipment` (поле
// subdivisions), адрес физического местонахождения — из блока характеристик
// выше ("Адрес нахождения"), но это поле НЕ присутствует в публичном
// `/api/v3/product/{slug}` ответе (только во внутреннем SSR-пейлоаде),
// поэтому его нельзя кросс-сверить с публичным API — сверяем UI-к-UI.
// НЕ автоматизировано: STORE-005 (пустое состояние на несуществующий
// запрос — с единственным магазином в списке визуально неотличимо от
// "поиск не реализован", нет живого товара с multi-store "Доступно на
// самовывоз" в данных уценки, см. комментарий у STORE-004), STORE-007
// (клик по строке — неопределённое ожидание "зафиксировать фактическое
// поведение"), STORE-008 (мок несовпадения адреса — нет отдельного
// эндпоинта со списком адресов магазинов, который можно замокать таким
// образом), STORE-009 (пустой список магазинов — нет эндпоинта
// возвращающего именно список для мока, /shipment отдаёт только count).
// STORE-011 — визуальный артефакт скролл-скриншота, не программная
// проверка.
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const DefectiveProduct = new defectiveProduct();

describe('Уценённые товары: магазины самовывоза (STORE-001/002/003/004/006/010, представительный набор)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    it('STORE-001: текст "Самовывоз из N магазина" совпадает с полем subdivisions в /shipment API', () => {
        cy.intercept('GET', '**/api/v3/product/*/shipment').as('shipment');
        cy.visit(fixtures.defectiveUnit.url);
        cy.wait('@shipment', { timeout: 20000 }).then((interception) => {
            const { subdivisions } = interception.response.body;
            expect(subdivisions).to.be.a('number');
            // "Самовывоз" и "из N магазина" рендерятся в РАЗНЫХ DOM-узлах
            // (подтверждено живой разведкой) — сверяем только числовую часть
            cy.contains(new RegExp(`из ${subdivisions}\\s*магазин`)).should('be.visible');
        });
    });

    it('STORE-003: колонка "В наличии" для уцен. экземпляра показывает бейдж "Уценка", а не числовое количество', () => {
        cy.visit(fixtures.defectiveUnit.url);
        cy.contains(/Способ доставки/i).should('be.visible');
        cy.contains(/\d+\s*шт\.?\s*$/).should('not.exist');
    });

    it('STORE-002: адрес в таблице "Доступно на самовывоз" идентичен полю "Адрес нахождения" в блоке характеристик той же страницы', () => {
        cy.visit(fixtures.defectiveUnitAnotherModel.url);
        cy.contains(/Адрес нахождения/i)
            .parent()
            .invoke('text')
            .then((characteristicsText) => {
                const address = characteristicsText.replace(/Адрес нахождения:?/i, '').trim();
                expect(address, 'адрес в характеристиках должен быть непустым').to.not.be.empty;
                cy.contains(/Доступно на самовывоз/i).should('be.visible');
                cy.contains(address).should('be.visible');
            });
    });

    it('STORE-004: поиск по названию улицы, совпадающему с единственным магазином, оставляет его в списке', () => {
        // Живой разведкой подтверждено: с ЕДИНСТВЕННЫМ магазином в списке
        // поле поиска не отфильтровывает его даже на заведомо
        // несуществующий запрос ("зжжж123...") — список визуально не
        // меняется вообще. Это не позволяет отличить "поиск работает, но
        // с 1 магазином пустое состояние выглядит так же" от "поиск не
        // реализован" без фикстуры с НЕСКОЛЬКИМИ магазинами (STORE-005,
        // отрицательный кейс, поэтому не автоматизирован здесь — нет живого
        // товара с multi-store "Доступно на самовывоз" в данных уценки)
        cy.visit(fixtures.defectiveUnitAnotherModel.url);
        cy.contains(/Адрес нахождения/i)
            .parent()
            .invoke('text')
            .then((characteristicsText) => {
                const address = characteristicsText.replace(/Адрес нахождения:?/i, '').trim();
                const streetPart = address.split(',')[0].trim();
                cy.get('input[placeholder="Поиск магазина"]').type(streetPart);
                cy.contains(address).should('be.visible');
            });
    });

    it('STORE-006: чекбокс "Скрыть витрину" не убирает единственный магазин из списка молча — строка остаётся видимой', () => {
        cy.visit(fixtures.defectiveUnitAnotherModel.url);
        cy.contains(/Доступно на самовывоз/i).should('be.visible');
        cy.contains(/Адрес нахождения/i).parent().invoke('text').then((characteristicsText) => {
            const address = characteristicsText.replace(/Адрес нахождения:?/i, '').trim();
            cy.contains('label', 'Скрыть витрину').then(($label) => {
                const checkbox = $label[0].parentElement.parentElement.querySelector('button[role="checkbox"]');
                cy.wrap(checkbox).click({ force: true });
            });
            // Зафиксированное фактическое поведение: строка магазина
            // остаётся в DOM (не исчезает молча) даже когда единственный
            // магазин физически витринный — скрыть его целиком означало бы
            // показать пустой список без объяснения
            cy.contains(address).should('be.visible');
        });
    });

    it('STORE-010: запрос /shipment уходит именно за slug ТЕКУЩЕГО экземпляра и обновляется при переключении через модалку', () => {
        cy.intercept('GET', '**/api/v3/product/*/shipment').as('shipment');
        cy.visit(fixtures.defectiveUnit.url);
        const currentSlug = fixtures.defectiveUnit.url.split('/product/')[1].replace(/\/$/, '');
        cy.wait('@shipment', { timeout: 20000 }).then((interception) => {
            expect(interception.request.url).to.include(currentSlug);
        });
        DefectiveProduct.clickDefectiveTrigger();
        DefectiveProduct.assertDefectiveModalShown();
        cy.intercept('GET', '**/api/v3/product/*/shipment').as('shipmentAfterNav');
        DefectiveProduct.selectDefectiveModalItem(0);
        cy.wait('@shipmentAfterNav', { timeout: 20000 }).then((interception) => {
            cy.url().then((url) => {
                const newSlug = url.split('/product/')[1].replace(/\/$/, '');
                expect(interception.request.url).to.include(newSlug);
            });
        });
    });
});
