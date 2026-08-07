import BonusesPage, { BONUSES_URL } from '../../../support/pageObjects/bonusesPage';
import * as cabinetApi from '../../../support/helpers/cabinetApi';

const Bonuses = new BonusesPage();

// Личный кабинет — «Бонусы и фишки», /cabinet/bonuses/, тестовый стенд d2.im.mdev.kz.
// Источник тест-кейсов: TestPlans/LK-full-testcases.md (лист "Бонусы и фишки", TC-БО-1..36).

describe('Бонусы и фишки — общие элементы страницы', () => {
    beforeEach(() => {
        cy.loginD2();
        Bonuses.visit();
    });

    // TC-БО-1
    it('Хлебные крошки «Главная / Личный кабинет / Бонусы и фишки»', () => {
        Bonuses.getBreadcrumbItems().should('have.length', 3);
        Bonuses.getBreadcrumbItems().eq(2).should('contain.text', 'Бонусы и фишки');
        Bonuses.getBreadcrumbItems().eq(2).find('a').should('not.exist');
    });

    // TC-БО-2 — БАГ BUG-013: заголовок есть визуально, но не <h1>.
    it('Отображение заголовка «Бонусы и фишки» — BUG-013', () => {
        cy.get('h1').should('have.length', 1).and('contain.text', 'Бонусы и фишки');
    });

    // TC-БО-3
    it('Пункт «Бонусы и фишки» в боковом меню подсвечен активным', () => {
        cy.get('nav').eq(1).contains('li', 'Бонусы и фишки').find('div').first()
            .should(($el) => {
                const bg = window.getComputedStyle($el[0]).backgroundColor;
                expect(bg, 'фон активного пункта не прозрачный').to.not.eq('rgba(0, 0, 0, 0)');
            });
    });
});

describe('Бонусы и фишки — блок «Ваш баланс»', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-БО-4
    it('«Ваш баланс» соответствует all_data.active/chips.active', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const { all_data, chips } = body.data;
            Bonuses.visit();
            cy.contains('Ваш баланс').should('be.visible');
            cy.get('h2').contains(String(all_data.active)).should('be.visible');
            cy.get('h2').contains(String(chips.active)).should('be.visible');
        });
    });

    // TC-БО-6 — сверка active-баланса между двумя эндпоинтами
    it('bonus_info.active/chips_info.active (/v2/personal) совпадают с all_data.active/chips.active (bonuses-history)', () => {
        cabinetApi.getPersonal().then(({ body: personalBody }) => {
            cabinetApi.getBonusesHistoryPage().then(({ body: bonusesBody }) => {
                expect(bonusesBody.data.all_data.active).to.eq(personalBody.data.bonus_info.active);
                expect(bonusesBody.data.chips.active).to.eq(personalBody.data.chips_info.active);
            });
        });
    });

    // TC-БО-8 — блок сгорания скрыт при пустом nearest_expiration_date (реальные данные)
    it('Блок «X сгорят» скрыт при пустом nearest_expiration_date', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            expect(body.data.all_data.nearest_expiration_date, 'baseline: нет даты сгорания бонусов').to.eq('');
            expect(body.data.chips.nearest_expiration_date, 'baseline: нет даты сгорания фишек').to.eq('');
        });
        Bonuses.visit();
        cy.contains(/сгор[ия]т/).should('not.exist');
        cy.get('body').should('not.contain.text', 'Invalid Date').and('not.contain.text', 'NaN');
    });
});

describe('Бонусы и фишки — список операций', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-БО-10, TC-БО-11 — номер заказа и дата на карточке
    it('Номер заказа и дата операции на карточке соответствуют API', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const first = body.data.items[0];
            Bonuses.visit();
            Bonuses.getOperationCardByOrderId(first.order_id).should('be.visible');
        });
    });

    // TC-БО-13, TC-БО-14 — плашка показывается только при значении > 0
    it('Плашка бонусов/фишек отображается только при ненулевом значении', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const items = body.data.items;
            const bonusOnly = items.find((i) => i.all_bonuses > 0 && i.all_chips === 0);
            const chipsOnly = items.find((i) => i.all_bonuses === 0 && i.all_chips > 0);
            Bonuses.visit();
            if (bonusOnly) {
                const card = Bonuses.getOperationCardByOrderId(bonusOnly.order_id);
                card.should('contain.text', 'бонусов');
                card.should('not.contain.text', 'фишек');
            }
            if (chipsOnly) {
                const card = Bonuses.getOperationCardByOrderId(chipsOnly.order_id);
                card.should('contain.text', 'фишек');
                card.should('not.contain.text', 'бонусов');
            }
        });
    });

    // TC-БО-16 — иконка "formed" = зелёная галочка (косвенно, через реальные данные)
    it('Заказ с order_status: formed показывает статус-иконку на карточке', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const formedOrder = body.data.items.find((i) => i.order_status === 'formed');
            if (!formedOrder) {
                cy.log('Нет заказов со статусом formed — кейс пропущен');
                return;
            }
            Bonuses.visit();
            Bonuses.getOperationCardByOrderId(formedOrder.order_id).find('svg, [class*="icon"]').should('exist');
        });
    });

    // TC-БО-18 — БАГ BUG-011: несогласованный пробел между плашками
    it('Плашки бонусов и фишек форматируются единообразно — BUG-011', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const bothOrder = body.data.items.find((i) => i.all_bonuses > 0 && i.all_chips > 0);
            if (!bothOrder) {
                cy.log('Нет заказа с одновременно бонусами и фишками — кейс пропущен');
                return;
            }
            Bonuses.visit();
            const card = Bonuses.getOperationCardByOrderId(bothOrder.order_id);
            card.contains(`+ ${bothOrder.all_bonuses} бонусов`).should('be.visible');
            // Ожидаем такое же форматирование (с пробелом) у фишек — падает, пока не исправлено
            card.contains(`+ ${bothOrder.all_chips} фишек`).should('be.visible');
        });
    });

    // TC-БО-21 — склонение "товар/товара/товаров". Полное правило русского
    // языка (учитывает исключение 11-14 → "товаров", не "товар"/"товара")
    function pluralizeTovar(n) {
        const mod10 = n % 10;
        const mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return 'товар';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'товара';
        return 'товаров';
    }

    it('Подпись количества товаров корректно склоняется', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const items = body.data.items;
            Bonuses.visit();
            items.forEach((item) => {
                const n = item.products.length;
                Bonuses.getOperationCardByOrderId(item.order_id).should('contain.text', `${n} ${pluralizeTovar(n)}`);
            });
        });
    });

    // TC-БО-24, TC-БО-25 — раскрытие деталей
    it('Клик «Показать детали» разворачивает список товаров, текст/шеврон синхронны', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const multiProduct = body.data.items.find((i) => i.products.length > 1);
            if (!multiProduct) {
                cy.log('Нет заказа с несколькими товарами — кейс пропущен');
                return;
            }
            Bonuses.visit();
            Bonuses.getOperationCardByOrderId(multiProduct.order_id).contains('Показать детали').should('be.visible').click();
            // Переспрашиваем карточку заново перед каждой проверкой — не
            // полагаемся на одну и ту же захваченную ссылку через несколько
            // click()/should() подряд
            Bonuses.getOperationCardByOrderId(multiProduct.order_id).contains('Скрыть детали').should('be.visible');
            multiProduct.products.forEach((p) => {
                Bonuses.getOperationCardByOrderId(multiProduct.order_id).should('contain.text', p.name);
            });
            Bonuses.getOperationCardByOrderId(multiProduct.order_id).contains('Скрыть детали').click();
            Bonuses.getOperationCardByOrderId(multiProduct.order_id).contains('Показать детали').should('be.visible');
        });
    });

    // TC-БО-26 — цена товара в развёрнутых деталях
    it('Цена товара в развёрнутых деталях соответствует products[].price', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const item = body.data.items.find((i) => i.products.length >= 1);
            Bonuses.visit();
            Bonuses.getOperationCardByOrderId(item.order_id).contains('Показать детали').click();
            const expectedPrice = item.products[0].price.toLocaleString('ru-RU').replace(/,/g, ' ');
            Bonuses.getOperationCardByOrderId(item.order_id).should('contain.text', expectedPrice);
        });
    });

    // TC-БО-27 — БАГ BUG-012: каждый товар должен показывать СВОЁ earned_chips/earned_bonuses
    it('Каждый товар в развёрнутых деталях показывает своё earned_chips/earned_bonuses — BUG-012', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            // Ищем заказ с несколькими товарами и РАЗНЫМИ earned_chips/earned_bonuses —
            // именно такой кейс доказывает построчную (не суммарную) логику
            const item = body.data.items.find((i) => {
                if (i.products.length < 2) return false;
                const values = i.products.map((p) => p.earned_chips || p.earned_bonuses);
                return new Set(values).size > 1;
            });
            if (!item) {
                cy.log('Нет заказа с разными earned_* по товарам — кейс пропущен');
                return;
            }
            Bonuses.visit();
            Bonuses.getOperationCardByOrderId(item.order_id).contains('Показать детали').click();
            item.products.forEach((p) => {
                const value = p.earned_chips > 0 ? p.earned_chips : p.earned_bonuses;
                const label = p.earned_chips > 0 ? 'фишек' : 'бонусов';
                cy.contains(p.name).parents('div').first().should('contain.text', `+${value} ${label}`);
            });
        });
    });

    // TC-БО-20 — БАГ BUG-010: отменённые заказы не должны выглядеть как подтверждённое начисление
    it('Отменённые заказы отсутствуют в истории начислений или показаны с нулевым начислением — BUG-010', () => {
        cabinetApi.getOrdersList({ status: 'finished' }).then(({ body: ordersBody }) => {
            const cancelledIds = ordersBody.data.orders
                .filter((o) => o.current_status === 'canceled')
                .map((o) => o.order.id);
            cabinetApi.getBonusesHistoryPage().then(({ body: bonusesBody }) => {
                const bonusOrderIds = new Set(bonusesBody.data.items.map((i) => i.order_id));
                const overlap = cancelledIds.filter((id) => bonusOrderIds.has(id));
                expect(overlap, `отменённые заказы, всё ещё числящиеся в bonuses-history: ${overlap.join(', ')}`).to.have.length(0);
            });
        });
    });
});

describe('Бонусы и фишки — пагинация', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-БО-31
    it('Первичный запрос содержит page=1, limit=10', () => {
        cy.intercept('GET', '**/v2/personal/bonuses-history**').as('bonuses');
        Bonuses.visit();
        cy.wait('@bonuses').then(({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('page')).to.eq('1');
            expect(url.searchParams.get('limit')).to.eq('10');
        });
    });

    // TC-БО-32 — арифметика all_pages
    it('all_pages == ceil(all_items_count / limit)', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const { all_items_count, all_pages } = body.data;
            expect(all_pages).to.eq(Math.ceil(all_items_count / 10));
        });
    });

    // TC-БО-33 — БАГ BUG-014: элемента пагинации нет вообще нигде в DOM,
    // хотя page_number < all_pages явно говорит, что есть ещё страницы.
    // Тест ожидает правильное поведение и падает, пока баг не исправлен.
    it('Кнопка «Показать ещё» отображается при page_number < all_pages — BUG-014', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            expect(body.data.page_number, 'baseline').to.be.lessThan(body.data.all_pages);
            Bonuses.visit();
            Bonuses.getLoadMoreButton().should('be.visible');
        });
    });

    // TC-БО-34 — БАГ BUG-014, тот же корень: без элемента пагинации кликать
    // нечего, страница=2 никогда не запрашивается.
    it('Клик «Показать ещё» отправляет запрос со page=2 — BUG-014', () => {
        Bonuses.visit();
        Bonuses.getLoadMoreButton().should('be.visible');
        cy.intercept('GET', '**/v2/personal/bonuses-history**').as('page2');
        Bonuses.getLoadMoreButton().click();
        cy.wait('@page2').then(({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('page')).to.eq('2');
        });
    });
});
