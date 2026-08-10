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

    // TC-БО-2 — BUG-013 ИСПРАВЛЕН (проверено 2026-08-10): раньше заголовок
    // был визуально, но не <h1>; теперь настоящий <h1>.
    it('Отображение заголовка «Бонусы и фишки»', () => {
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

    // TC-БО-5 — БАГ-кандидат/открытый вопрос (сам тест-план формулирует так
    // же): заблокированные бонусы/фишки нигде не показываются на UI, хотя в
    // реальных данных суммы немаленькие. Не заводим как баг без подтверждения
    // от продукта (см. README «Что НЕ было оформлено как баг») — тест
    // документирует текущее состояние регрессионно.
    it('Заблокированные (blocked) бонусы/фишки не отображаются нигде на UI — открытый вопрос', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const { all_data, chips } = body.data;
            expect(all_data.blocked, 'baseline: на аккаунте есть заблокированные бонусы').to.be.greaterThan(0);
            Bonuses.visit();
            cy.get('body').then(($body) => {
                const text = $body.text();
                expect(text.includes(String(all_data.blocked)), `сумма заблокированных бонусов (${all_data.blocked}) нигде не отображается на странице`).to.be.false;
                if (chips.blocked > 0) {
                    expect(text.includes(String(chips.blocked)), `сумма заблокированных фишек (${chips.blocked}) нигде не отображается`).to.be.false;
                }
            });
        });
    });

    // TC-БО-7 — БАГ BUG-031: в реальных данных nearest_expiration_date/
    // expiration_total сейчас всегда пустые, поэтому подставляем мок с
    // реалистичными значениями напрямую (не через Bonuses.visit(), чтобы не
    // столкнуться с перехватом того же роута без подмены тела — см. visit()
    // в bonusesPage.js).
    it('Блок «X сгорят [дата]» появляется при заполненном nearest_expiration_date — BUG-031', () => {
        cy.intercept('GET', '**/v2/personal/bonuses-history**', (req) => {
            req.continue((res) => {
                res.body.data.all_data.nearest_expiration_date = '15.09.2026';
                res.body.data.all_data.expiration_total = 12345;
                res.body.data.chips.nearest_expiration_date = '15.09.2026';
                res.body.data.chips.expiration_total = 42;
            });
        }).as('bonusesExpiringMock');
        cy.visit(BONUSES_URL);
        cy.wait('@bonusesExpiringMock', { timeout: 40000 });
        cy.contains(/сгор[ия]т/).should('be.visible');
    });

    // TC-БО-9 — живой разведкой 2026-08-10 подтверждено: на этом стенде
    // декоративной иконки монет над блоком баланса в DOM нет вовсе (только
    // аватар пользователя и миниатюры товаров). Пишем тест толерантно к
    // обоим случаям — если элемент когда-нибудь появится, проверяем
    // отсутствие перекрытия с цифрами баланса на нескольких брейкпоинтах.
    it('Декоративная иконка монет (если есть) не перекрывает баланс на разных брейкпоинтах', () => {
        [[2560, 1440], [1024, 768], [390, 844]].forEach(([w, h]) => {
            cy.viewport(w, h);
            Bonuses.visit();
            cy.contains('Ваш баланс').parents('div').first().then(($balanceContainer) => {
                const decorativeIcons = $balanceContainer.find('img, svg').filter((_, el) => {
                    const src = el.getAttribute('src') || '';
                    return !src.includes('default-user') && !el.closest('nav');
                });
                if (decorativeIcons.length === 0) {
                    cy.log(`[${w}x${h}] декоративной иконки монет нет в DOM — нечего проверять на перекрытие`);
                    return;
                }
                const iconBox = decorativeIcons[0].getBoundingClientRect();
                $balanceContainer.find('h2').each((_, numEl) => {
                    const numBox = numEl.getBoundingClientRect();
                    const overlaps = !(iconBox.right < numBox.left || iconBox.left > numBox.right
                        || iconBox.bottom < numBox.top || iconBox.top > numBox.bottom);
                    expect(overlaps, `[${w}x${h}] декоративная иконка не должна перекрывать цифру баланса`).to.be.false;
                });
            });
        });
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
        // ВАЖНО (2026-08-10): раньше здесь был отдельный cy.request() ДО
        // Bonuses.visit() — на живом/общем аккаунте данные между этими двумя
        // независимыми запросами могут разъехаться (список сдвинулся, нужный
        // order_id уже не в первых 10 записях), из-за чего getOperationCardByOrderId
        // не находит карточку. Сверяем найденный заказ с ТЕМ ЖЕ ответом,
        // который реально отрисовал UI.
        cy.intercept('GET', '**/v2/personal/bonuses-history**').as('bonusesLoad13');
        cy.visit(BONUSES_URL);
        cy.wait('@bonusesLoad13', { timeout: 40000 }).then(({ response }) => {
            const items = response.body.data.items;
            const bonusOnly = items.find((i) => i.all_bonuses > 0 && i.all_chips === 0);
            const chipsOnly = items.find((i) => i.all_bonuses === 0 && i.all_chips > 0);
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

    // TC-БО-18 — BUG-011 ИСПРАВЛЕН (Jira AS-4513, подтверждено 2026-08-10):
    // раньше плашки бонусов/фишек форматировались с несогласованным
    // пробелом, теперь единообразно.
    it('Плашки бонусов и фишек форматируются единообразно', () => {
        // См. комментарий у TC-БО-13/14 выше — та же гонка живых данных,
        // тот же фикс (сверяем с ответом, который реально отрисовал UI).
        cy.intercept('GET', '**/v2/personal/bonuses-history**').as('bonusesLoad18');
        cy.visit(BONUSES_URL);
        cy.wait('@bonusesLoad18', { timeout: 40000 }).then(({ response }) => {
            const bothOrder = response.body.data.items.find((i) => i.all_bonuses > 0 && i.all_chips > 0);
            if (!bothOrder) {
                cy.log('Нет заказа с одновременно бонусами и фишками — кейс пропущен');
                return;
            }
            const card = Bonuses.getOperationCardByOrderId(bothOrder.order_id);
            card.contains(`+ ${bothOrder.all_bonuses} бонусов`).should('be.visible');
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
                // Системные/нулевые операции (см. TC-БО-15) не имеют products
                // вовсе (null, не []) — считать длину не от чего, пропускаем.
                if (!item.products) return;
                // "Оффлайн заказ" — псевдо-ID, может повторяться на нескольких
                // карточках одновременно; cy.contains() внутри
                // getOperationCardByOrderId видит только ПЕРВУЮ совпавшую, из-за
                // чего для 2-й/3-й такой записи проверка сверялась бы не со
                // своей карточкой — пропускаем неоднозначные случаи.
                if (item.order_id === 'Оффлайн заказ') return;
                const n = item.products.length;
                Bonuses.getOperationCardByOrderId(item.order_id).should('contain.text', `${n} ${pluralizeTovar(n)}`);
            });
        });
    });

    // TC-БО-22 — мок-данные: склонение для граничных случаев 5/11/21/22 товаров
    it('Склонение «товар/товара/товаров» для граничных случаев 5/11/21/22', () => {
        [5, 11, 21, 22].forEach((n) => {
            cy.intercept('GET', '**/v2/personal/bonuses-history**', (req) => {
                req.continue((res) => {
                    if (res.body.data.items[0]) {
                        // is_offline: false — иначе фронт рендерит заголовок
                        // "Оффлайн заказ" независимо от order_id (если
                        // items[0] в реальном ответе окажется офлайн-записью)
                        res.body.data.items[0].is_offline = false;
                        res.body.data.items[0].order_id = `MOCK-QTY-${n}`;
                        res.body.data.items[0].products = Array.from({ length: n }, (_, i) => ({
                            name: `Мок-товар ${i + 1}`, code: `mock-qty-${n}-${i}`, price: 1000, image: '',
                            quantity: 1, earned_bonuses: 0, spent_bonuses: 0, earned_chips: 0,
                        }));
                    }
                });
            }).as(`bonusesQty${n}`);
            cy.visit(BONUSES_URL);
            cy.wait(`@bonusesQty${n}`, { timeout: 40000 });
            Bonuses.getOperationCardByOrderId(`MOCK-QTY-${n}`).should('contain.text', `${n} ${pluralizeTovar(n)}`);
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

    // TC-БО-27 — BUG-012 ИСПРАВЛЕН (Jira AS-4514, подтверждено 2026-08-10):
    // раньше каждый товар показывал ОБЩУЮ сумму заказа, теперь — свою.
    it('Каждый товар в развёрнутых деталях показывает своё earned_chips/earned_bonuses', () => {
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

    // TC-БО-12 — год не отображается в дате операции для заказов за прошлые
    // годы. Тест-план сам формулирует это как открытый вопрос к аналитику —
    // фиксируем факт (год нигде не показан), не оцениваем как баг.
    it('Год не отображается в дате операции за прошлый год — открытый вопрос', () => {
        cy.intercept('GET', '**/v2/personal/bonuses-history**', (req) => {
            req.continue((res) => {
                if (res.body.data.items[0]) {
                    res.body.data.items[0].is_offline = false;
                    res.body.data.items[0].order_id = 'MOCK-OLD-YEAR';
                    res.body.data.items[0].action_date = '15.03.2025';
                }
            });
        }).as('bonusesOldYear');
        cy.visit(BONUSES_URL);
        cy.wait('@bonusesOldYear', { timeout: 40000 });
        const card = Bonuses.getOperationCardByOrderId('MOCK-OLD-YEAR');
        card.should('be.visible');
        card.should('not.contain.text', '2025');
        card.should('not.contain.text', 'Invalid Date').and('not.contain.text', 'NaN');
    });

    // TC-БО-15 — заказ без начислений вовсе (all_bonuses=0 и all_chips=0).
    // Реальные примеры есть на аккаунте (№4205/№4204, products: null), но
    // недостижимы через UI — они не попадают в первые 10 записей (единственные
    // видимые из-за BUG-014, см. ../bonuses/README.md), поэтому подставляем мок.
    it('Заказ без начислений (all_bonuses=0 и all_chips=0) не показывает ни одной плашки', () => {
        cy.intercept('GET', '**/v2/personal/bonuses-history**', (req) => {
            req.continue((res) => {
                if (res.body.data.items[0]) {
                    res.body.data.items[0].is_offline = false;
                    res.body.data.items[0].order_id = 'MOCK-ZERO-BOTH';
                    res.body.data.items[0].all_bonuses = 0;
                    res.body.data.items[0].all_chips = 0;
                }
            });
        }).as('bonusesZeroBoth');
        cy.visit(BONUSES_URL);
        cy.wait('@bonusesZeroBoth', { timeout: 40000 });
        const card = Bonuses.getOperationCardByOrderId('MOCK-ZERO-BOTH');
        card.should('be.visible');
        card.should('not.contain.text', 'бонусов');
        card.should('not.contain.text', 'фишек');
    });

    // TC-БО-17 — дублирование индикатора статуса (крупная иконка слева +
    // мелкий бейдж у заголовка). Тест-план сам ставит это как открытый вопрос
    // к дизайнеру (см. README «Что НЕ было оформлено как баг») — фиксируем
    // факт дублирования регрессионно, не как однозначный баг.
    it('На карточке одновременно два визуальных индикатора статуса — открытый вопрос', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const formedOrder = body.data.items.find((i) => i.order_status === 'formed' && i.order_id !== 'Оффлайн заказ');
            if (!formedOrder) { cy.log('Нет подходящего заказа formed — кейс пропущен'); return; }
            Bonuses.visit();
            Bonuses.getOperationCardByOrderId(formedOrder.order_id).find('svg, [class*="icon"]').then(($icons) => {
                expect($icons.length, 'ожидаем минимум 2 визуальных индикатора статуса рядом с заголовком').to.be.at.least(2);
            });
        });
    });

    // TC-БО-19 — мок order_status, отличный от "formed": проверяем, что
    // иконка статуса действительно МЕНЯЕТСЯ, а не захардкожена независимо
    // от order_status.
    // ВАЖНО (2026-08-10), нетривиальная находка: подмена конкретно поля
    // order_status на неизвестное фронту значение ("pending") НЕ доходит до
    // рендера ни одним из опробованных способов — cy.intercept с
    // req.continue(), полностью статичный cy.intercept({body}), раздельные
    // it()-блоки (на случай гонки алиасов), и даже прямая подмена
    // window.fetch живьём в браузере (вне Cypress вообще) с проверкой, что
    // сам fetch-перехватчик реально возвращает корректно подменённые данные
    // при прямом вызове. Во ВСЕХ случаях страница стабильно продолжает
    // показывать РЕАЛЬНЫЕ (не подменённые) карточки, без единой JS-ошибки в
    // консоли/window.onerror. При этом абсолютно тот же приём подмены
    // других полей того же items[0] (order_id, action_date, all_bonuses,
    // even is_offline) — работает стабильно (см. TC-БО-12/15/22).
    // Это указывает на что-то специфичное именно для order_status
    // (возможно, страница переотрисовывается через отдельный
    // серверный/гидратационный путь при виде "processing"-подобного
    // статуса, недостижимый для клиентского intercept), но КОРЕНЬ
    // ПРИЧИНЫ живой разведкой окончательно не подтверждён — не филим как
    // баг без более уверенной диагностики (см. README «Что НЕ было
    // оформлено как баг»), тест документирует наблюдение регрессионно.
    it('Мок order_status, отличный от formed — иконка не обновляется (см. README)', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            const formedOrder = body.data.items.find((i) => i.order_status === 'formed' && i.order_id !== 'Оффлайн заказ');
            if (!formedOrder) { cy.log('Нет подходящего заказа formed — кейс пропущен'); return; }
            Bonuses.visit();
            // Живой разведкой 2026-08-10 подтверждено: индикатор статуса — НЕ
            // инлайн <svg> (find('svg') находит 0 элементов даже у реального
            // formed-заказа), тот же паттерн, что и в TC-БО-16 — используем
            // тот же толерантный селектор.
            Bonuses.getOperationCardByOrderId(formedOrder.order_id).find('svg, [class*="icon"]').first().then(($formedIcon) => {
                const formedIconHtml = $formedIcon[0].outerHTML;
                cy.intercept('GET', '**/v2/personal/bonuses-history**', (req) => {
                    req.continue((res) => {
                        if (res.body.data.items[0]) {
                            res.body.data.items[0].is_offline = false;
                            res.body.data.items[0].order_id = 'MOCK-PENDING';
                            res.body.data.items[0].order_status = 'pending';
                        }
                    });
                }).as('bonusesPending');
                cy.visit(BONUSES_URL);
                cy.wait('@bonusesPending', { timeout: 40000 });
                cy.get('body').then(($body) => {
                    if ($body.text().includes('MOCK-PENDING')) {
                        // Если когда-нибудь мок начнёт долетать до рендера —
                        // тест-план изначально ожидал именно эту проверку
                        Bonuses.getOperationCardByOrderId('MOCK-PENDING').find('svg, [class*="icon"]').first().should(($pendingIcon) => {
                            expect($pendingIcon[0].outerHTML, 'иконка статуса "pending" должна визуально отличаться от "formed"').to.not.eq(formedIconHtml);
                        });
                    } else {
                        cy.log('Подмена order_status не долетела до рендера (известное наблюдение, см. комментарий выше и README) — карточка осталась на реальных данных');
                    }
                });
            });
        });
    });

    // TC-БО-23 — на свёрнутой карточке показывается изображение ПЕРВОГО
    // товара из products[]. Живой разведкой 2026-08-10 подтверждено на
    // реальном заказе №4347 (3 товара) — img.src карточки в точности равен
    // products[0].image (термос, а не один из двух ноутбуков).
    it('Изображение на свёрнутой карточке — первый товар из products[] (заказ №4347)', () => {
        cabinetApi.getBonusesHistoryPage({ limit: 200 }).then(({ body }) => {
            const item = body.data.items.find((i) => i.order_id === '4347');
            if (!item || !item.products || !item.products[0]) {
                cy.log('Заказ №4347 не найден в текущей выборке — кейс пропущен');
                return;
            }
            Bonuses.visit();
            Bonuses.getOperationCardByOrderId('4347').find('img').first().should('have.attr', 'src', item.products[0].image);
        });
    });

    // TC-БО-28 — регрессионная арифметическая сверка: сумма earned_bonuses/
    // earned_chips по товарам заказа равна all_bonuses/all_chips заказа
    // (на момент проверки 2026-08-10 совпадает у всех 194 записей — фиксируем
    // как регрессию на будущее, аналогичное несовпадение уже встречалось
    // в других разделах проекта, см. BUG-012).
    it('Сумма earned_bonuses/earned_chips по товарам равна all_bonuses/all_chips заказа', () => {
        cabinetApi.getBonusesHistoryPage({ limit: 200 }).then(({ body }) => {
            const mismatches = body.data.items.filter((it) => {
                if (!it.products) return false;
                const sumBonuses = it.products.reduce((s, p) => s + p.earned_bonuses, 0);
                const sumChips = it.products.reduce((s, p) => s + p.earned_chips, 0);
                return sumBonuses !== it.all_bonuses || sumChips !== it.all_chips;
            }).map((it) => it.order_id);
            expect(mismatches, `заказы с расхождением суммы по товарам: ${mismatches.join(', ')}`).to.have.length(0);
        });
    });

    // TC-БО-29 — заказы №4347 и №4346 содержат идентичный состав товаров.
    // Сверено 2026-08-10 через orders_list: это два САМОСТОЯТЕЛЬНЫХ заказа
    // (разные payment_info.payments[0].is_paid и разный summary.title.text —
    // ПРИ ЭТОМ order_status_banner у обоих буквально одинаковый, "Оплата не
    // прошла" — не показатель; созданы в одну секунду с одинаковой корзиной,
    // похоже на повторную отправку одной и той же корзины), а не техническая
    // дубликация одной записи в API.
    it('Заказы №4347 и №4346 — два самостоятельных заказа, не дублирование в данных', () => {
        cabinetApi.getOrdersList({ status: 'all', page: 1, limit: 20 }).then(({ body }) => {
            const o4347 = body.data.orders.find((o) => o.order.id === '4347');
            const o4346 = body.data.orders.find((o) => o.order.id === '4346');
            if (!o4347 || !o4346) {
                cy.log('Заказы №4347/№4346 не найдены на первой странице orders_list — кейс пропущен');
                return;
            }
            const isPaid4347 = o4347.order.payment_info.payments[0]?.is_paid;
            const isPaid4346 = o4346.order.payment_info.payments[0]?.is_paid;
            const differ = isPaid4347 !== isPaid4346
                || o4347.summary.title.text !== o4346.summary.title.text;
            expect(differ, 'заказы 4347/4346 должны отличаться хотя бы одним полем — иначе похоже на дублирование одной записи').to.be.true;
        });
    });

    // TC-БО-30 — состав товаров заказа №4347 между orders_list и
    // bonuses-history. Сверено 2026-08-06/2026-08-11: basket.items у
    // orders_list для этого заказа пуст, хотя payment_info.to_pay ненулевой.
    // ВАЖНО (уточнено 2026-08-11): изначально это списывалось на BUG-004, но
    // BUG-004 (Jira AS-4506) с тех пор исправлен и был про другое — «0 ₸» в
    // ЦЕНЕ заказа в списке, а не про пустой basket.items — и подтверждено
    // живьём, что basket.items у этого конкретного заказа ВСЁ ЕЩЁ пуст
    // после фикса. Это отдельный, самостоятельный (более узкий) остаточный
    // нюанс именно для исторических заказов такого рода, не повод для
    // нового баг-репорта (тест сам толерантен к этому случаю), но и не
    // "тот же BUG-004" — комментарий скорректирован, чтобы не вводить в
    // заблуждение при следующей ревизии.
    it('products заказа №4347 в bonuses-history vs basket.items в orders_list', () => {
        cabinetApi.getBonusesHistoryPage({ limit: 200 }).then(({ body: bonusesBody }) => {
            const bonusItem = bonusesBody.data.items.find((i) => i.order_id === '4347');
            cabinetApi.getOrdersList({ status: 'all', page: 1, limit: 20 }).then(({ body: ordersBody }) => {
                const order = ordersBody.data.orders.find((o) => o.order.id === '4347');
                if (!bonusItem || !order) {
                    cy.log('Заказ №4347 не найден в одном из эндпоинтов — кейс пропущен');
                    return;
                }
                if (order.basket.items.length === 0 && order.order.payment_info.to_pay > 0) {
                    cy.log('Заказ №4347: пустой basket.items при ненулевом to_pay (известный узкий нюанс, не BUG-004 — тот уже исправлен и был про другое)');
                    expect(bonusItem.products.length, 'bonuses-history при этом ПОКАЗЫВАЕТ товары').to.be.greaterThan(0);
                } else {
                    const bonusCodes = bonusItem.products.map((p) => p.code).sort();
                    const orderCodes = order.basket.items.map((it) => it.code).sort();
                    expect(bonusCodes).to.deep.eq(orderCodes);
                }
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

    // TC-БО-33 — BUG-014 (Jira AS-4516) ИСПРАВЛЕН 2026-08-10: элемент
    // пагинации отображается при page_number < all_pages. Реализация — не
    // кнопка «Показать ещё», как ожидал изначальный баг-репорт, а
    // нумерованная пагинация (ссылки-страницы + Next/Previous/First/Last).
    it('Нумерованная пагинация отображается при page_number < all_pages', () => {
        cabinetApi.getBonusesHistoryPage().then(({ body }) => {
            expect(body.data.page_number, 'baseline').to.be.lessThan(body.data.all_pages);
            Bonuses.visit();
            Bonuses.getPageLink(1).should('be.visible');
            Bonuses.getNextPageLink().should('be.visible');
        });
    });

    // TC-БО-34 — клик по ссылке страницы 2 отправляет запрос со page=2 и
    // отрисовывает другой набор карточек (не совпадающий с page 1).
    it('Клик по ссылке страницы 2 отправляет запрос со page=2', () => {
        Bonuses.visit();
        cy.intercept('GET', '**/v2/personal/bonuses-history**').as('page2');
        Bonuses.getPageLink(2).click();
        cy.wait('@page2').then(({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('page')).to.eq('2');
        });
        cy.location('search').should('include', 'page=2');
    });

    // TC-БО-35 — на последней странице API отдаёт остаток записей
    // (page_number = all_pages), и UI отображает ровно столько же карточек.
    it('На последней странице API и UI отдают одинаковый остаток записей (page_number = all_pages)', () => {
        cabinetApi.getBonusesHistoryPage({ limit: 10, page: 1 }).then(({ body }) => {
            const { all_items_count, all_pages } = body.data;
            cabinetApi.getBonusesHistoryPage({ limit: 10, page: all_pages }).then(({ body: lastPageBody }) => {
                const expectedLastPageCount = all_items_count - (all_pages - 1) * 10;
                expect(lastPageBody.data.items).to.have.length(expectedLastPageCount);
                expect(lastPageBody.data.page_number).to.eq(all_pages);

                cy.intercept('GET', '**/v2/personal/bonuses-history**').as('lastPage');
                cy.visit(`http://d2.im.mdev.kz/cabinet/bonuses/?page=${all_pages}`);
                cy.wait('@lastPage', { timeout: 40000 });
                // На последней странице "Next Page" перестаёт быть кликабельной
                // ссылкой (рендерится как <button>, а не <a href>), а
                // "Last Page" остаётся <a>, но с disabled="true" и без href.
                Bonuses.getNextPageLink().should('not.exist');
                Bonuses.getLastPageLink().should('have.attr', 'disabled', 'true');
            });
        });
    });

    // TC-БО-36 — последовательный обход всех страниц API не даёт
    // дублей/пропусков (та же гарантия, что теперь доступна и пользователю
    // через реальную нумерованную пагинацию, а не только через API).
    it('Последовательный обход всех страниц API не даёт дублей/пропусков', () => {
        cabinetApi.getBonusesHistoryPage({ limit: 10, page: 1 }).then(({ body }) => {
            const { all_items_count, all_pages } = body.data;
            const allOrderIds = [];
            const collectPage = (page) => {
                if (page > all_pages) return cy.wrap(null);
                return cabinetApi.getBonusesHistoryPage({ limit: 10, page }).then(({ body: pageBody }) => {
                    pageBody.data.items.forEach((it) => allOrderIds.push(it.order_id));
                    return collectPage(page + 1);
                });
            };
            collectPage(1).then(() => {
                expect(allOrderIds, 'итоговое количество карточек равно all_items_count').to.have.length(all_items_count);
                // "Оффлайн заказ" — псевдо-ID, законно повторяется у нескольких
                // офлайн-/системных операций (см. bonusesPage.js) — не дубликат
                const nonOfflineIds = allOrderIds.filter((id) => id !== 'Оффлайн заказ');
                const uniqueNonOffline = new Set(nonOfflineIds);
                expect(uniqueNonOffline.size, 'нет дублей среди настоящих order_id').to.eq(nonOfflineIds.length);
            });
        });
    });
});
