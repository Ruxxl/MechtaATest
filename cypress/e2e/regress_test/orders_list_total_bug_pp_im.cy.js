// BUG-002 (BugReport/Оформление заказа/BUG-002-orders-list-total-missing-delivery.md):
// в списке «Мои заказы» (/cabinet/orders/) сумма в шапке карточки НЕОПЛАЧЕННОГО
// заказа с курьерской (платной) доставкой показывает только стоимость товаров
// (basket.total_prices.discounted_price), без учёта стоимости доставки — тогда
// как кнопка «Оплатить N ₸» внутри той же карточки и API payment_info.total
// корректно показывают полную сумму (товары + доставка).
//
// Найдено 2026-08-19 живым прогоном регресса оплаты картой на pp.im.mdev.kz
// (см. .claude/skills/mechta-e2e-testing/references/manual-card-payment-regress.md).
// У заказов с самовывозом (доставка = 0 ₸) баг визуально не проявляется, т.к.
// суммы совпадают — источник данных в шапке карточки всё равно неверный,
// просто маскируется нулевой доставкой.
//
// Тест фиксирует ОЖИДАЕМОЕ (правильное) поведение и должен ПАДАТЬ, пока баг
// не исправлен.
import checkoutPpIm from '../../support/pageObjects/checkoutPpIm';
import { getOrdersList } from '../../support/helpers/checkoutPpImApi';

const Checkout = new checkoutPpIm();
const PRODUCT = 'batareyka-camelion-cr1632-1-shtdot'; // ~390 ₸
const ADDRESS_STREET = 'Кенесары 40';
// Единственная зона доставки по Астане, доступная на 2026-08-19 (бесплатной
// зоны сейчас нет вообще — см. project memory о live-проверке через API,
// 0 из 55 зон с ценой 0) — платная, 1000 ₸, этого достаточно, чтобы
// товар-сумма и полная сумма к оплате отличались, что и нужно для теста.
const PAID_ZONE = 'Доставка по г.Астана';

describe('BUG-002: список «Мои заказы» — сумма в шапке карточки', () => {
    beforeEach(() => {
        cy.loginPpIm();

        // Дальше по сценарию бэкенд после "Подтвердить заказ" сам делает
        // top-level редирект на epay.homebank.kz — та самая страница, чья
        // собственная загрузка (сторонние RUM/аналитика-скрипты,
        // dynatrace.homebank.kz) не укладывается ни в какой разумный
        // pageLoadTimeout в headless Cypress и блокирует вообще ЛЮБУЮ
        // следующую команду (не только чтение cy.url()). Нам сама эта
        // страница не нужна — только факт, что заказ уже создан на бэкенде
        // к моменту редиректа.
        //
        // ВАЖНО (найдено живым прогоном 2026-08-19, несколько итераций):
        // - широкий матчер 'https://epay.homebank.kz/**' без ограничений
        //   ловит и саму навигацию, и служебные XHR/fetch страницы эквайера
        //   (те ждут JSON и падают с "Unexpected token '<'" на HTML-заглушке);
        // - resourceType:'document' в CDP-реализации Cypress НЕ матчит
        //   top-level cross-origin навигацию, инициированную JS
        //   (`location.href = ...`), а не кликом по `<a>` — с ним intercept
        //   вообще не срабатывает, и снова ловим page-load timeout;
        // - сужение URL до пути /payform/ с HTML-заглушкой всё ещё ловит
        //   встроенный bootstrap-скрипт страницы, ждущий JSON на том же пути.
        // Рабочий вариант: 204 No Content на сам запрос навигации — по
        // HTTP-семантике браузер не переходит на такой ответ (страница
        // остаётся на pp.im.mdev.kz), это одновременно убирает зависающий
        // `load` и не даёт встроенным скриптам получить что-то не-JSON.
        cy.intercept('https://epay.homebank.kz/payform/**', { statusCode: 204 }).as('acquirerStub');
    });

    it('шапка карточки неоплаченного заказа с курьерской доставкой показывает полную сумму (товары + доставка), а не только товары', () => {
        Checkout.clearBasket();
        Checkout.visitProduct(PRODUCT);
        Checkout.addToBasket();

        Checkout.visitCheckout();
        Checkout.stepOnePerson();
        Checkout.selectDeliveryMethod('Доставка');
        Checkout.addNewAddressWithZone(ADDRESS_STREET, PAID_ZONE);
        Checkout.goToStepTwoNext();

        Checkout.selectPaymentMethod('Картой онлайн');
        Checkout.goToStepThreeNext();

        // Инлайним confirmOrder() вручную (не через Checkout.confirmOrder())
        // и не трогаем cy.url()/redirect после — см. комментарий выше про
        // зависающий load эквайера. Заказ (POST /v2/checkout) уже успешно
        // создан на бэкенде к моменту появления модалки подтверждения.
        cy.contains('button', /^Оплатить/, { timeout: 20000 }).first().click({ force: true });
        cy.contains('button', 'Подтвердить заказ', { timeout: 20000 }).first().click({ force: true });

        // Дожидаемся самого факта попытки редиректа на эквайер (подтверждает,
        // что бэкенд успешно создал заказ и решил вести дальше на оплату) —
        // не саму реальную страницу, см. intercept выше.
        cy.wait('@acquirerStub', { timeout: 30000 });
        cy.wait(1000); // мгновение, чтобы заказ гарантированно появился в orders_list

        getOrdersList().then(({ body }) => {
            // Найдено живой разведкой 2026-08-19: сразу после подтверждения
            // заказ имеет статус "created", а не "waiting_for_payment" —
            // похоже, в "waiting_for_payment" он переходит только когда
            // браузер реально долетает до страницы эквайера (что мы здесь
            // намеренно блокируем, см. intercept выше). Для этого теста
            // разница неважна — оба статуса означают "заказ создан, но не
            // оплачен". Код товара в заказе — "...-shtdot" (с суффиксом, как
            // в URL slug), а не "...-sht", как в самой корзине/чекауте, —
            // отдельное наблюдение, не тема этого теста.
            const candidates = body.data.orders
                .filter((o) => ['created', 'waiting_for_payment'].includes(o.current_status))
                .filter((o) => (o.basket?.items || []).some((i) => i.code === 'batareyka-camelion-cr1632-1-shtdot'))
                .filter((o) => o.order?.delivery_info?.type === 'courier')
                .sort((a, b) => Number(b.order.id) - Number(a.order.id));
            const order = candidates[0];
            expect(order, 'только что созданный заказ должен быть в /v2/personal/orders_list').to.exist;

            const orderId = order.order.id;
            const itemsTotal = order.basket.total_prices.discounted_price;
            const deliveryPay = order.order.delivery_info.pay;
            const fullTotal = order.order.payment_info.total;

            // Сама платная зона реально платная — иначе тест ничего не
            // отличает и молча "проходит" по неверной причине.
            expect(deliveryPay, 'выбранная зона доставки должна быть платной').to.be.greaterThan(0);
            expect(fullTotal, 'payment_info.total = товары + доставка').to.eq(itemsTotal + deliveryPay);

            cy.visit('http://pp.im.mdev.kz/cabinet/orders/');
            cy.dismissCityConfirmPopup();

            // Карточка конкретно этого заказа — климбим до контейнера
            // .bg-mi-brand-base-background.rounded-mi-xl (подтверждено живым
            // разведочным прогоном 2026-08-19: он единственный общий предок
            // и для бейджа "№ {id}", и для суммы в шапке, и для кнопки
            // "Оплатить"), дальше работаем только внутри него.
            cy.contains('.bg-mi-brand-base-background.rounded-mi-xl', `№ ${orderId}`, { timeout: 15000 })
                .within(() => {
                    // БАГ: сейчас здесь показывается itemsTotal (390 ₸), а
                    // должно быть fullTotal (1390 ₸) — то же число, что и на
                    // кнопке "Оплатить".
                    cy.get('p.text-mi-subheader-3')
                        .invoke('text')
                        .then((headerText) => {
                            const headerAmount = Number(headerText.replace(/[^\d]/g, ''));
                            expect(
                                headerAmount,
                                `сумма в шапке карточки заказа ${orderId} должна включать доставку`
                            ).to.eq(fullTotal);
                        });

                    cy.contains('button', 'Оплатить').should('contain.text', `${fullTotal.toLocaleString('ru-RU')}`);
                });
        });
    });
});
