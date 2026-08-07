import CouponsPage, { COUPONS_URL } from '../../../support/pageObjects/couponsPage';
import * as cabinetApi from '../../../support/helpers/cabinetApi';

const Coupons = new CouponsPage();

// Личный кабинет — «Купоны», /cabinet/coupons/, тестовый стенд d2.im.mdev.kz.
// Источник тест-кейсов: TestPlans/LK-full-testcases.md (лист "Купоны", TC-КУ-1..16).
//
// ВАЖНО: на тестовом аккаунте нет ни активных, ни использованных купонов
// (GET /v3/personal/promo-codes возвращает [] для обоих filterBy) — раздел
// "Карточка купона" (TC-КУ-13..16) сам тест-план помечает как требующий
// примера с непустыми данными, здесь не покрыт по той же причине.

describe('Купоны — общие элементы и именование страницы', () => {
    beforeEach(() => {
        cy.loginD2();
        Coupons.visit();
    });

    // TC-КУ-1 — БАГ BUG-018: несогласованное именование страницы в разных
    // местах ("Мои купоны" в крошке vs "Купоны" в заголовке/меню).
    // Тест ожидает единообразие и падает, пока баг не исправлен.
    it('Название страницы одинаково в крошке и заголовке — BUG-018', () => {
        Coupons.getBreadcrumbItems().eq(2).invoke('text').then((breadcrumbText) => {
            cy.get('h1, h2').contains(/Купон/).invoke('text').should('eq', breadcrumbText.trim());
        });
    });

    // Заголовок страницы — БАГ BUG-017: используется <h2>, не <h1>.
    it('Заголовок «Купоны» — <h1> — BUG-017', () => {
        cy.get('h1').should('have.length', 1).and('contain.text', 'Купоны');
    });

    // TC-КУ-2, TC-КУ-3 — БАГ BUG-019: в отличие от orders/bonuses/cards,
    // пункт "Купоны" вообще не подсвечивается на своей же странице. Тест
    // ожидает правильное поведение и падает, пока баг не исправлен.
    it('Пункт «Купоны» в боковом меню подсвечен активным — BUG-019', () => {
        cy.get('nav').eq(1).contains('li', 'Купоны').find('div').first()
            .should(($el) => {
                const bg = window.getComputedStyle($el[0]).backgroundColor;
                expect(bg, 'фон активного пункта не прозрачный').to.not.eq('rgba(0, 0, 0, 0)');
            });
    });
});

describe('Купоны — вкладки «Активные»/«Завершенные»', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-КУ-4
    it('По умолчанию активна вкладка «Активные», запрос с filterBy=active', () => {
        cy.intercept('GET', '**/v3/personal/promo-codes**').as('coupons');
        cy.visit(COUPONS_URL);
        cy.wait('@coupons', { timeout: 40000 }).then(({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('filterBy')).to.eq('active');
        });
        Coupons.getActiveTab().should('have.attr', 'aria-selected', 'true');
    });

    // TC-КУ-5 — параметр filterBy=used (не finished/completed, как в заказах)
    it('Переключение на «Завершенные» отправляет запрос с filterBy=used', () => {
        Coupons.visit();
        cy.intercept('GET', '**/v3/personal/promo-codes**').as('usedTab');
        Coupons.getUsedTab().click();
        cy.wait('@usedTab', { timeout: 40000 }).then(({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('filterBy')).to.eq('used');
        });
        Coupons.getUsedTab().should('have.attr', 'aria-selected', 'true');
    });

    // TC-КУ-7
    it('Переключение обратно на «Активные» возвращает filterBy=active', () => {
        Coupons.visit();
        Coupons.getUsedTab().click();
        Coupons.getUsedTab().should('have.attr', 'aria-selected', 'true');
        cy.intercept('GET', '**/v3/personal/promo-codes**').as('backToActive');
        Coupons.getActiveTab().click();
        cy.wait('@backToActive', { timeout: 40000 }).then(({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('filterBy')).to.eq('active');
        });
    });

    // TC-КУ-8, TC-КУ-9 — ровно одна вкладка активна визуально в любой момент
    it('Ровно одна вкладка визуально активна (aria-selected) в любой момент', () => {
        Coupons.visit();
        Coupons.getActiveTab().should('have.attr', 'aria-selected', 'true');
        Coupons.getUsedTab().should('have.attr', 'aria-selected', 'false');
        Coupons.getUsedTab().click();
        Coupons.getUsedTab().should('have.attr', 'aria-selected', 'true');
        Coupons.getActiveTab().should('have.attr', 'aria-selected', 'false');
    });

    // TC-КУ-10 — быстрые множественные клики не оставляют рассинхрон
    it('Быстрые множественные клики оставляют итоговое состояние = последнему клику', () => {
        Coupons.visit();
        Coupons.getUsedTab().click();
        Coupons.getActiveTab().click();
        Coupons.getUsedTab().click();
        Coupons.getActiveTab().click();
        // Последний клик — "Активные"
        Coupons.getActiveTab().should('have.attr', 'aria-selected', 'true');
        Coupons.getUsedTab().should('have.attr', 'aria-selected', 'false');
    });
});

describe('Купоны — пустые состояния', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-КУ-11 — реальные данные: на аккаунте нет активных купонов
    it('Пустое состояние «Нет доступных купонов» на вкладке «Активные» (реальные данные)', () => {
        cabinetApi.getCoupons({ filterBy: 'active' }).then(({ body }) => {
            const list = body.data || body;
            expect(list, 'baseline: нет активных купонов').to.have.length(0);
        });
        Coupons.visit();
        cy.contains('Нет доступных купонов').should('be.visible');
        cy.contains('Здесь будут купоны которые вы сможете применить при оформлении').should('be.visible');
    });

    // TC-КУ-12 — реальные данные: на аккаунте нет использованных купонов
    it('Пустое состояние вкладки «Завершенные» (реальные данные)', () => {
        cabinetApi.getCoupons({ filterBy: 'used' }).then(({ body }) => {
            const list = body.data || body;
            expect(list, 'baseline: нет использованных купонов').to.have.length(0);
        });
        Coupons.visit();
        Coupons.getUsedTab().click();
        // Фиксируем фактический текст плейсхолдера (в тест-плане не подтверждён примером)
        cy.get('main').invoke('text').then((text) => {
            cy.log('Фактический текст пустого состояния «Завершенные»: ' + text.slice(0, 200));
        });
        // <main>, не <body> — <body> включает текст инлайн-скриптов
        // аналитики, где буквально встречаются строки "undefined"/"null"
        // как часть JS-кода (см. cabinet_overview.cy.js)
        cy.get('main').should('not.contain.text', 'undefined').and('not.contain.text', 'null');
    });
});

describe('Купоны — негативные сценарии (обработка ошибок API)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    it('GET /v3/personal/promo-codes — 500 не роняет остальную часть страницы', () => {
        cy.intercept('GET', '**/v3/personal/promo-codes**', { statusCode: 500, body: {} }).as('serverError');
        cy.visit(COUPONS_URL);
        cy.wait('@serverError', { timeout: 40000 });
        cy.get('nav').eq(1).should('be.visible');
    });
});
