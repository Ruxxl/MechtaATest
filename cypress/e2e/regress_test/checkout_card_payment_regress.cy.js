// Регресс: оформление заказа с оплатой картой на тестовом стенде d5.im.mdev.kz,
// где подключён новый эквайринг test-epay.epayment.kz (Halyk ePay) взамен
// checkout.ioka.kz. Покрывает сценарии, реально пройденные вручную
// 2026-08-12 (см. memory project_checkout_acquirer_migration_test и
// BugReport/Оформление заказа/): бесплатная/платная доставка, самовывоз из
// разных магазинов, смена города, экспресс-доставка, промокод, бонусы,
// товар с подарком — с обязательной сверкой «Итого» и состава корзины
// против API на каждом шаге.
//
// ВАЖНО: тест намеренно НЕ завершает реальную оплату (её проходили вручную
// тестовой картой ...6736 по решению пользователя) — каждый сценарий
// доходит только до подтверждения заказа и проверки редиректа на
// https://test-epay.epayment.kz/payform/, дальше не идёт.
import checkoutD5 from '../../support/pageObjects/checkoutD5';
import { getBasket, getCheckout, getOrder } from '../../support/helpers/checkoutD5Api';
import { normalizePrice } from '../../support/helpers/textUtils';

const Checkout = new checkoutD5();

// Оба товара подтверждены живой разведкой 2026-08-12 на стенде d5.
const PRODUCTS = {
    microwave: 'mikrovolnovaya-pech-midea-mm-7p012-mz-black', // 29 990 ₸, обычная доставка
    phone: 'smartfon-infinix-note-50-8256gb-mountain-shade', // 178 990 ₸, поддерживает экспресс-доставку
};

const ADDRESS_STREET = 'Кенесары 40';

// Страница нового эквайера (test-epay.epayment.kz) грузится медленно
// (30-50с, см. memory project_checkout_acquirer_migration_test) — поднимаем
// pageLoadTimeout для всего файла, иначе сама навигация после "Подтвердить
// заказ" валит тест по дефолтным 60с раньше, чем успевает отработать
// assertRedirectedToAcquirer().
Cypress.config('pageLoadTimeout', 90000);

describe('Оформление заказа — Оплата картой (test-epay.epayment.kz, стенд d5.im.mdev.kz)', () => {

    beforeEach(() => {
        cy.loginD5();
    });

    it('1 товар, бесплатная доставка по Астане — Итого совпадает с API, редирект на новый эквайер', () => {
        Checkout.clearBasket();
        Checkout.visitProduct(PRODUCTS.microwave);
        Checkout.addToBasket();

        Checkout.visitCheckout();
        Checkout.stepOnePerson();
        Checkout.selectDeliveryMethod('Доставка');
        Checkout.addNewAddressWithZone(ADDRESS_STREET, 'Бесплатная доставка по г.Астана');
        Checkout.goToStepTwoNext();

        getBasket().then(({ body: basketBody }) => {
            const itemsTotal = basketBody.data.total_prices.discounted_price;

            getCheckout().then(({ body: checkoutBody }) => {
                const freeVariant = checkoutBody.data.delivery_info.deliveries.variants
                    .find((v) => v.name === 'Бесплатная доставка по г.Астана');
                expect(freeVariant, 'бесплатная зона должна присутствовать в API').to.exist;
                expect(freeVariant.price).to.eq(0);

                Checkout.selectPaymentMethod('Картой онлайн');
                Checkout.assertTotal(itemsTotal + freeVariant.price);
                Checkout.goToStepThreeNext();

                Checkout.confirmOrder();
                Checkout.assertRedirectedToAcquirer();
            });
        });
    });

    it('Несколько товаров, платная доставка — Итого = сумма товаров + стоимость зоны', () => {
        Checkout.clearBasket();
        Checkout.visitProduct(PRODUCTS.microwave);
        Checkout.addToBasket();
        Checkout.visitProduct(PRODUCTS.phone);
        Checkout.addToBasket();

        Checkout.visitCheckout();
        Checkout.stepOnePerson();
        Checkout.selectDeliveryMethod('Доставка');

        getCheckout().then(({ body: checkoutBody }) => {
            const paidVariant = checkoutBody.data.delivery_info.deliveries.variants
                .find((v) => v.type === 'courier' && v.price > 0);
            expect(paidVariant, 'должна быть хотя бы одна платная зона доставки').to.exist;

            Checkout.addNewAddressWithZone(ADDRESS_STREET, paidVariant.name);
            Checkout.goToStepTwoNext();

            getBasket().then(({ body: basketBody }) => {
                expect(basketBody.data.items.length).to.be.at.least(2);
                const itemsTotal = basketBody.data.total_prices.discounted_price;

                Checkout.selectPaymentMethod('Картой онлайн');
                Checkout.assertTotal(itemsTotal + paidVariant.price);
                Checkout.goToStepThreeNext();

                Checkout.confirmOrder();
                Checkout.assertRedirectedToAcquirer();
            });
        });
    });

    it('Несколько товаров, самовывоз из магазина — Итого совпадает с API, редирект на новый эквайер', () => {
        Checkout.clearBasket();
        Checkout.visitProduct(PRODUCTS.microwave);
        Checkout.addToBasket();
        Checkout.visitProduct(PRODUCTS.phone);
        Checkout.addToBasket();

        Checkout.visitCheckout();
        Checkout.stepOnePerson();
        Checkout.selectDeliveryMethod('Самовывоз');

        getCheckout().then(({ body: checkoutBody }) => {
            const store = checkoutBody.data.delivery_info.pickup.stores[0];
            Checkout.selectPickupStore(store.shop_name);
            Checkout.goToStepTwoNext();

            getBasket().then(({ body: basketBody }) => {
                const itemsTotal = basketBody.data.total_prices.discounted_price;

                Checkout.selectPaymentMethod('Картой онлайн');
                Checkout.assertTotal(itemsTotal);
                Checkout.goToStepThreeNext();

                Checkout.confirmOrder();
                Checkout.assertRedirectedToAcquirer();
            });
        });
    });

    it('1 товар, самовывоз из другого магазина — редирект на новый эквайер', () => {
        Checkout.clearBasket();
        Checkout.visitProduct(PRODUCTS.microwave);
        Checkout.addToBasket();

        Checkout.visitCheckout();
        Checkout.stepOnePerson();
        Checkout.selectDeliveryMethod('Самовывоз');

        getCheckout().then(({ body: checkoutBody }) => {
            const stores = checkoutBody.data.delivery_info.pickup.stores;
            expect(stores.length, 'должно быть больше одного магазина самовывоза').to.be.at.least(2);
            const store = stores[1];
            Checkout.selectPickupStore(store.shop_name);
            Checkout.goToStepTwoNext();

            Checkout.selectPaymentMethod('Картой онлайн');
            Checkout.goToStepThreeNext();

            Checkout.confirmOrder();
            Checkout.assertRedirectedToAcquirer();
        });
    });

    it('Смена города на Алматы + бесплатная доставка — редирект на новый эквайер', () => {
        Checkout.clearBasket();
        Checkout.visitProduct(PRODUCTS.microwave);
        Checkout.addToBasket();

        Checkout.visitCheckout();
        Checkout.stepOnePerson();
        Checkout.switchCity('Алматы');

        cy.contains('г. Алматы').should('be.visible');

        Checkout.selectDeliveryMethod('Доставка');
        // Официальное название улицы — "проспект Абая" (подтверждено live
        // разведкой 2026-08-14 через уже сохранённые на аккаунте адреса
        // Алматы), не просто "Абая" — иначе автокомплит не находит подсказку.
        Checkout.addNewAddressWithZone('проспект Абая 10', 'Бесплатная доставка');
        Checkout.goToStepTwoNext();

        Checkout.selectPaymentMethod('Картой онлайн');
        Checkout.goToStepThreeNext();

        Checkout.confirmOrder();
        Checkout.assertRedirectedToAcquirer();
    });

    // Наличие экспресс-доставки у конкретного товара — временное состояние
    // каталога/склада (см. feedback_testplan_ui_drift), может исчезнуть
    // между прогонами независимо от кода теста — skip вместо ложного fail,
    // если у проверяемого товара её сейчас нет.
    it('Экспресс-доставка за 2 часа доступна и выбирается для поддерживающего товара', function () {
        Checkout.clearBasket();
        Checkout.visitProduct(PRODUCTS.phone);
        Checkout.addToBasket();

        Checkout.visitCheckout();
        Checkout.stepOnePerson();

        getCheckout().then(({ body: checkoutBody }) => {
            const expressVariant = checkoutBody.data.delivery_info.deliveries.variants
                .find((v) => v.type === 'express');
            if (!expressVariant) {
                cy.log('Сейчас нет экспресс-доставки для проверяемого товара — тест skip');
                this.skip();
                return;
            }
            expect(expressVariant.price).to.eq(0);

            Checkout.selectDeliveryMethod('Экспресс доставка за 2 часа');
            // Экспресс-доставке нужен адрес, но БЕЗ выбора зоны (у неё нет
            // комбобокса "Район доставки" — подтверждено live).
            Checkout.addNewAddressSimple(ADDRESS_STREET);
            Checkout.goToStepTwoNext();

            Checkout.selectPaymentMethod('Картой онлайн');
            Checkout.goToStepThreeNext();

            Checkout.confirmOrder();
            Checkout.assertRedirectedToAcquirer();
        });
    });

    // Купон ME232PR — общий ресурс на shared-тестовом аккаунте с ограниченным
    // числом использований; сам этот регресс (и предыдущие ручные прогоны)
    // его расходует. Skip вместо ложного fail, если он окончательно
    // недоступен (не появляется в UI даже после повторного ввода).
    it('Промокод ME232PR: включение/выключение переключателя корректно меняет Итого в корзине', function () {
        Checkout.clearBasket();
        Checkout.visitProduct(PRODUCTS.microwave);
        Checkout.addToBasket();
        Checkout.visitBasket();

        const PROMO_CODE = 'ME232PR';

        getBasket().then(({ body }) => {
            // Купон может либо уже висеть на аккаунте активным (см. BUG-001/AS-4565),
            // либо вообще отсутствовать в coupon_list (если истрачен предыдущими
            // прогонами регресса — "Подтвердить заказ" реально создаёт заказ на
            // бэке, что может расходовать одноразовые купоны), либо быть в списке,
            // но неактивным — обрабатываем все три варианта. Дополнительно сверяем
            // с UI: бывает, что API всё ещё отдаёт applied:true, а на самой
            // странице переключателя с кодом уже нет (истощён) — тогда идём по
            // ветке "ввести заново", а не пытаемся кликнуть несуществующий тоггл.
            const coupon = (body.data.coupon_list || []).find((c) => c.code === PROMO_CODE);

            cy.get('body').then(($body) => {
                const couponVisibleInUi = $body.text().includes(PROMO_CODE);

                if (coupon && coupon.applied && couponVisibleInUi) {
                    // купон уже активен — проверяем, что его отключение и повторное
                    // включение корректно пересчитывает Итого
                    Checkout.togglePromoSwitch(PROMO_CODE);
                    cy.wait(1000);

                    getBasket().then(({ body: withoutCoupon }) => {
                        expect(withoutCoupon.data.coupon_list.find((c) => c.code === PROMO_CODE).applied).to.eq(false);
                        Checkout.assertTotal(withoutCoupon.data.total_prices.base_price);

                        Checkout.togglePromoSwitch(PROMO_CODE);
                        cy.wait(1000);

                        getBasket().then(({ body: withCoupon }) => {
                            expect(withCoupon.data.coupon_list.find((c) => c.code === PROMO_CODE).applied).to.eq(true);
                            Checkout.assertTotal(withCoupon.data.total_prices.discounted_price);
                        });
                    });
                } else {
                    Checkout.enterPromoCode(PROMO_CODE);
                    cy.wait(1500);

                    getBasket().then(({ body: afterEnter }) => {
                        const enteredCoupon = (afterEnter.data.coupon_list || []).find((c) => c.code === PROMO_CODE);
                        expect(enteredCoupon, 'промокод должен появиться в coupon_list после ввода').to.exist;

                        // Ввод кода добавляет его в список, но не всегда сразу активирует —
                        // переключатель в "Программе лояльности" может требовать явного клика.
                        // Если и после ввода его нет в UI — купон, похоже, окончательно
                        // исчерпан (лимит использований на shared-аккаунте), не баг теста.
                        if (!enteredCoupon.applied) {
                            cy.get('body').then(($body2) => {
                                if (!$body2.text().includes(PROMO_CODE)) {
                                    cy.log('Промокод не появился в UI даже после повторного ввода — похоже, исчерпан на аккаунте, тест skip');
                                    this.skip();
                                    return;
                                }
                                Checkout.togglePromoSwitch(PROMO_CODE);
                                cy.wait(1000);
                            });
                        }

                        getBasket().then(({ body: withCoupon }) => {
                            const applied = (withCoupon.data.coupon_list || []).find((c) => c.code === PROMO_CODE);
                            expect(applied.applied, 'промокод должен быть применён (после ввода и/или включения переключателя)').to.eq(true);
                            Checkout.assertTotal(withCoupon.data.total_prices.discounted_price);
                        });
                    });
                }
            });
        });
    });

    // BUG-001 / AS-4565 (BugReport/Оформление заказа/BUG-001-...): промокод,
    // однажды применённый, навсегда «прилипает» к аккаунту и автоматически
    // применяется к любым НОВЫМ, не связанным с ним корзинам. Тест фиксирует
    // ОЖИДАЕМОЕ (правильное) поведение и должен ПАДАТЬ, пока баг не исправлен.
    it('BUG-001 (AS-4565): промокод не должен автоматически применяться к новой, не связанной корзине', () => {
        Checkout.clearBasket();
        Checkout.visitProduct(PRODUCTS.microwave);
        Checkout.addToBasket(); // ни разу не вводим промокод в этом тесте

        getBasket().then(({ body }) => {
            const couponApplied = (body.data.coupon_list || []).some((c) => c.applied);
            expect(
                couponApplied,
                'промокод не должен автоприменяться к новой корзине без явного повторного ввода (BUG-001, AS-4565)'
            ).to.eq(false);
        });
    });

    // Баланс бонусов на тестовом аккаунте — общий ресурс, который тратится
    // реальными заказами (в т.ч. созданными этим же регрессом) — может
    // временно обнулиться. Skip вместо ложного fail, если сейчас 0.
    it('Списание бонусов уменьшает Итого на шаге "Способ оплаты"', function () {
        Checkout.clearBasket();
        Checkout.visitProduct(PRODUCTS.microwave);
        Checkout.addToBasket();

        Checkout.visitCheckout();
        Checkout.stepOnePerson();
        Checkout.selectDeliveryMethod('Доставка');
        Checkout.addNewAddressWithZone(ADDRESS_STREET, 'Бесплатная доставка по г.Астана');
        Checkout.goToStepTwoNext();

        getCheckout().then(({ body: checkoutBody }) => {
            const bonusesAvailable = checkoutBody.data.payment_info.bonuses.available;
            if (!bonusesAvailable) {
                cy.log('На аккаунте сейчас 0 бонусов — тест skip');
                this.skip();
                return;
            }

            cy.contains('К оплате').parent().invoke('text').then((beforeText) => {
                const beforeTotal = Number(normalizePrice(beforeText.match(/К оплате([\d\s ]+)₸/)[1]));

                Checkout.toggleSpendBonuses();
                cy.wait(1000);

                cy.contains('К оплате').parent().invoke('text').then((afterText) => {
                    const afterTotal = Number(normalizePrice(afterText.match(/К оплате([\d\s ]+)₸/)[1]));

                    expect(afterTotal, 'после списания бонусов Итого должно уменьшиться').to.be.lessThan(beforeTotal);
                    expect(beforeTotal - afterTotal, 'списанная сумма не должна превышать доступные бонусы')
                        .to.be.at.most(bonusesAvailable);
                });
            });
        });
    });

    // Наличие активной акции с подарком — временное маркетинговое состояние
    // каталога (см. feedback_testplan_ui_drift), поэтому тест ищет подходящий
    // товар динамически через API вместо хардкода конкретного slug, и
    // корректно skip-ится, если сейчас ни у одного проверяемого товара нет
    // подарков (вместо ложного падения на устаревшем предположении).
    it('Товар с подарком: модалка выбора добавляет позицию is_gift в корзину', function () {
        cy.request({
            method: 'GET',
            url: `http://api.d5.im.mdev.kz/v2/product/${PRODUCTS.phone}`,
            headers: { Accept: 'application/json', 'X-Mechta-Device-Id': 'cypress-test-device-id' },
            failOnStatusCode: false,
        }).then(({ body }) => {
            const gifts = body?.data?.gifts;
            if (!gifts || gifts.length === 0) {
                cy.log('Сейчас нет активной акции с подарком на проверяемом товаре — тест skip');
                this.skip();
                return;
            }

            Checkout.clearBasket();
            Checkout.visitProduct(PRODUCTS.phone);

            cy.contains('button', 'Выберите подарок').should('be.visible').click();
            cy.contains('[role="dialog"], div', 'Выберите подарок').should('be.visible');

            // Выбираем первый вариант в каждой группе подарков, затем добавляем в корзину
            cy.get('[role="dialog"]').within(() => {
                cy.get('input[type="radio"], button[role="radio"]').first().click({ force: true });
                cy.contains('button', 'Добавить').should('be.visible').click();
            });

            getBasket().then(({ body: basketBody }) => {
                const giftItems = basketBody.data.items.filter((item) => item.is_gift);
                expect(giftItems.length, 'после выбора подарка в корзине должна появиться позиция is_gift').to.be.at.least(1);
            });
        });
    });
});
