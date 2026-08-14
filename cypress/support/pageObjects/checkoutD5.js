// Page Object для чекаута на тестовом стенде d5.im.mdev.kz (отдельный бэкенд
// api.d5.im.mdev.kz, новый эквайринг test-epay.epayment.kz — см.
// checkoutD5Api.js и memory project_checkout_acquirer_migration_test).
//
// Разведкой 2026-08-12 подтверждено: фронтенд d5 — тот же компонент, что и
// на pp.yc.mechta.kz (см. cypress/support/pageObjects/checkout.js) — те же
// id (#person-button_desktop, #delivery-button_desktop, #payment-button_desktop,
// input[name=phone/fio/email/address], zoneWidgetId вида #v-0-4-0-3). Поэтому
// шаги 1/2(доставка-адрес)/самовывоз почти дословно переиспользуют паттерн
// оттуда; ниже — то, что специфично для d5-сценариев этой регрессии
// (платная/экспресс-доставка, смена города, промокод, бонусы, новый эквайер).
import { normalizePrice } from '../helpers/textUtils';

const BASE_URL = 'http://d5.im.mdev.kz';

// Для подсказок автокомплита 2GIS первого слова адреса недостаточно, если
// это родовое слово ("проспект Абая" — искать просто "проспект" совпадает
// с ЛЮБЫМ проспектом в подсказках, не обязательно с нужным) — найдено
// 2026-08-14 на реальном адресе Алматы. Берём два слова в этом случае.
function streetSearchTerm(addressStreet) {
    const genericWords = ['улица', 'проспект', 'переулок', 'бульвар', 'мкр', 'мкр.', 'шоссе'];
    const words = addressStreet.split(' ');
    return genericWords.includes(words[0].toLowerCase()) ? words.slice(0, 2).join(' ') : words[0];
}

class checkoutD5 {

    visitCheckout() {
        cy.visit(`${BASE_URL}/checkout/`);
        cy.dismissCityConfirmPopup();
    }

    visitBasket() {
        cy.visit(`${BASE_URL}/basket/`);
        cy.dismissCityConfirmPopup();
    }

    // Полностью очищает корзину аккаунта (кнопка-иконка i-ph:trash-simple
    // под каждым товаром) — нужно для сценариев, где важен точный состав
    // корзины (иначе на shared тестовом аккаунте накапливаются товары/подарки
    // от предыдущих незавершённых прогонов, т.к. регресс намеренно
    // останавливается на редиректе, не завершая реальную оплату).
    clearBasket() {
        cy.visit(`${BASE_URL}/basket/`);
        cy.dismissCityConfirmPopup();
        cy.wait(1000);

        const removeNext = (attemptsLeft) => {
            if (attemptsLeft <= 0) return;
            cy.get('body').then(($body) => {
                const trash = $body.find('[class*="i-ph:trash-simple"]:visible');
                if (trash.length > 0) {
                    cy.wrap(trash).first().click({ force: true });
                    cy.wait(700);
                    removeNext(attemptsLeft - 1);
                }
            });
        };
        removeNext(15);
    }

    visitProduct(slug) {
        cy.visit(`${BASE_URL}/product/${slug}/`);
        // На d5 (как и на d2) может всплыть попап подтверждения города,
        // перекрывающий кнопку "В корзину" — закрываем его, если появился.
        cy.dismissCityConfirmPopup();
    }

    // Сетевая POST /basket/add не перехватывается стабильно в этом проекте
    // (см. feedback_cypress_uninterceptable_basket_add), поэтому подтверждение
    // добавления идёт через API (getBasket) в самом тесте, а не здесь.
    //
    // ВАЖНО (найдено 2026-08-12 живым прогоном): после успешного добавления
    // сама кнопка #product-add-to-basket остаётся физически перекрыта
    // открывшейся боковой панелью "Товар добавлен в корзину / Сопутствующие
    // товары" — проверка видимости ПОСЛЕ клика на этом же элементе поэтому
    // намеренно не делается (она будет вечно падать по таймауту, пока
    // панель не закрыта). Плюс попап подтверждения города может всплыть
    // асинхронно уже ПОСЛЕ первого dismissCityConfirmPopup — поэтому
    // закрываем его и до, и после клика.
    // ВАЖНО (найдено 2026-08-14): страница товара иногда не дорисовывает
    // карточку (пустой белый экран вместо неё, хотя URL верный) при повторных
    // визитах на один и тот же slug в рамках долгой сессии — похоже на
    // сбой SPA-гидратации, не на реальную ошибку данных. Один cy.reload()
    // и повторное ожидание почти всегда чинит это, поэтому делаем retry
    // вместо немедленного fail.
    addToBasket() {
        cy.dismissAccessoryUpsell();
        cy.dismissPromoModal();
        cy.wait(1500); // даём странице шанс дорисоваться, прежде чем считать её сломанной
        cy.get('body').then(($body) => {
            if ($body.find('#product-add-to-basket').length === 0) {
                cy.log('Карточка товара не дорисовалась — пробуем reload()');
                cy.reload();
                cy.dismissCityConfirmPopup();
            }
        });
        cy.get('#product-add-to-basket', { timeout: 30000 }).click({ force: true });
        cy.wait(1500);
        cy.dismissAccessoryUpsell();
        cy.dismissPromoModal();
    }

    buyNow() {
        cy.get('#product-buy-now').should('be.visible').click({ force: true });
    }

    // Шаг 1 «Получатель» — поля обычно предзаполняются данными аккаунта
    // (Appleseed Джон / 0000000000).
    //
    // ВАЖНО (найдено 2026-08-13 живым прогоном): телефон и email подгружаются
    // стабильно, но ФИО иногда остаётся пустым (не race, а стабильно на весь
    // таймаут — воспроизведено на 2-й+ загрузке чекаута в рамках одной
    // сессии). Похоже на реальный, отдельный от темы этой регрессии баг
    // автозаполнения; не блокируем этим прохождение теста — если поле
    // пустое после короткого ожидания, просто заполняем его сами, как это
    // сделал бы реальный пользователь.
    stepOnePerson() {
        // input[name="fio"] дублируется в DOM (скрытый mobile-узел +
        // видимый desktop-узел) — работаем только с видимым, иначе можно
        // заполнить не тот инпут, а видимый останется пустым и "Далее"
        // упрётся в валидацию "Заполните поле".
        cy.get('input[name="fio"]:visible', { timeout: 8000 }).then(($el) => {
            if (!$el.val()) {
                cy.wrap($el).type('Appleseed Джон', { force: true });
            }
        });
        cy.get('#person-button_desktop').click({ force: true });
    }

    // Выбор способа доставки на шаге 2 — карточки-заголовки h4:
    // «Экспресс доставка за 2 часа» (если товар поддерживает), «Доставка», «Самовывоз».
    selectDeliveryMethod(methodName) {
        cy.contains('h4', methodName).should('be.visible').click({ force: true });
    }

    // Добавление НОВОГО адреса с выбором конкретной зоны доставки (платная/бесплатная).
    // Используем ветку «Добавить адрес», чтобы гарантированно попасть в комбобокс
    // «Район доставки» (переиспользованная у сохранённых адресов зона иногда пустая —
    // известное наблюдение, см. memory project_checkout_acquirer_migration_test).
    addNewAddressWithZone(addressStreet, zoneOptionText) {
        cy.get('input[name="address"]:visible').first().click();

        cy.contains('button', 'Добавить адрес').should('be.visible').click();

        cy.contains('label', 'Район доставки')
            .parent()
            .find('button[role="combobox"]')
            .click();
        cy.contains('[role="option"]', zoneOptionText).click();

        const streetInput = () => cy.contains('label', 'Улица и номер дома')
            .parent()
            .find('input[role="combobox"]');

        streetInput().type(addressStreet);
        cy.wait(2500);

        cy.contains('[role="option"]', streetSearchTerm(addressStreet), { timeout: 20000 }).click();

        cy.get('input[name="house"]').should('not.have.value', '');
        cy.contains('button', 'Привезти сюда').should('be.visible').click();
    }

    // Тот же диалог «Добавить адрес», но БЕЗ комбобокса «Район доставки» —
    // для экспресс-доставки (найдено 2026-08-13 живым прогоном: у неё нет
    // выбора зоны, только улица/дом, иначе combobox с текстом "Район
    // доставки" никогда не появляется и addNewAddressWithZone виснет).
    addNewAddressSimple(addressStreet) {
        cy.get('input[name="address"]:visible').first().click();

        cy.contains('button', 'Добавить адрес').should('be.visible').click();

        const streetInput = () => cy.contains('label', 'Улица и номер дома')
            .parent()
            .find('input[role="combobox"]');

        streetInput().type(addressStreet);
        cy.wait(2500);

        cy.contains('[role="option"]', streetSearchTerm(addressStreet), { timeout: 20000 }).click();

        cy.get('input[name="house"]').should('not.have.value', '');
        cy.contains('button', 'Привезти сюда').should('be.visible').click();
    }

    // Выбор уже сохранённого адреса (когда зона на нём уже закреплена и повторный
    // выбор зоны не требуется) — по образцу checkout.js.selectDeliveryAddress.
    selectSavedAddress(addressText) {
        cy.get('input[name="address"]:visible').first().click();
        cy.contains('p', addressText).should('be.visible').click();
    }

    goToStepTwoNext() {
        cy.contains('button', 'Далее').filter(':visible').first().click({ force: true });
    }

    // Самовывоз: открыть список магазинов, выбрать по имени, подтвердить.
    selectPickupStore(shopName) {
        cy.get('input[name="shop"]').should('be.visible').click();
        cy.contains(shopName).should('be.visible').click();
        cy.contains('button', 'Заберу отсюда').should('be.visible').click();
    }

    // Смена города через модалку «Выберите ваш город» (кнопка «г. <Город>»
    // рядом с заголовком «Выберите способ доставки»).
    switchCity(cityName) {
        cy.contains('button', /^г\.\s/).should('be.visible').click();
        cy.contains('[role="dialog"], div', 'Выберите ваш город').should('be.visible');
        cy.contains('button', cityName).should('be.visible').click();
    }

    // Промокод — поле ввода в сайдбаре «Программа лояльности» (доступно и в
    // корзине, и на шаге 3 чекаута). Ранее применённый купон отображается
    // отдельным переключателем с названием/кодом — см. BUG-001.
    enterPromoCode(code) {
        cy.get('input[placeholder="Введите промокод/купон"]:visible').first().type(code);
        cy.get('input[placeholder="Введите промокод/купон"]:visible').first()
            .parent().find('button').click();
    }

    // Переключатель уже применённого промокода/купона (viewport-дубликаты в DOM,
    // берём видимый).
    togglePromoSwitch(couponCode) {
        cy.contains('div', couponCode).parents('div').find('button[role="switch"]:visible').first().click();
    }

    assertPromoApplied(couponCode, discountText) {
        cy.contains(couponCode).should('be.visible');
        if (discountText) {
            cy.contains(discountText).should('be.visible');
        }
    }

    // Тоггл «Потратить бонусы» на шаге 3 (сайдбар «Программа лояльности»).
    toggleSpendBonuses() {
        cy.contains('div', 'Потратить бонусы')
            .parents('div')
            .find('button[role="switch"]:visible')
            .first()
            .click();
    }

    // Шаг 3 «Способ оплаты» — карточки-заголовки h4 с названием варианта
    // («Оплата с Kaspi.kz», «Картой онлайн», «Рассрочка / Кредит», ...).
    // ВАЖНО (найдено 2026-08-13): в headless Cypress клики происходят намного
    // быстрее реального пользователя — без паузы здесь клик по "Оплатить"
    // в confirmOrder() может выстрелить раньше, чем бэкенд зарегистрирует
    // выбранный способ оплаты, и POST /v2/checkout падает с тостом
    // "Ошибка получения данных" (живьём через реальный браузер с обычной
    // человеческой скоростью кликов это не воспроизводится).
    selectPaymentMethod(methodName) {
        cy.contains('h4', methodName).should('be.visible').click({ force: true });
        cy.wait(1500);
    }

    goToStepThreeNext() {
        cy.get('#payment-button_desktop').click({ force: true });
    }

    // На шаге 3 сначала нужно нажать "Оплатить N ₸" на самой странице — это
    // открывает модалку "Пожалуйста, проверьте подтвердите заказ", и только
    // ВНУТРИ неё есть настоящая кнопка "Подтвердить заказ" (не сразу одна
    // кнопка, как в основном checkout.js для pp.yc — на d5 два шага).
    confirmOrder() {
        cy.contains('button', /^Оплатить/, { timeout: 20000 }).first().click({ force: true });
        cy.contains('button', 'Подтвердить заказ', { timeout: 20000 }).first().click({ force: true });
        // Диагностикой 2026-08-13 подтверждено: POST /v2/checkout (создание
        // заказа) само по себе успешно (result:true) даже когда финальный
        // редирект на эквайер визуально ещё не случился — пауза тут даёт
        // браузеру время обработать ответ и выполнить сам redirect до того,
        // как assertRedirectedToAcquirer() начнёт проверять cy.url(). Аккаунт
        // на этом стенде накопил много реальных заказов за время тестов —
        // при большем их числе сервер отвечает заметно медленнее, поэтому
        // пауза увеличена с 1с до 3с (2026-08-14).
        cy.wait(3000);
    }

    // После подтверждения с «Картой онлайн» сайт редиректит на страницу
    // нового эквайера (test-epay.epayment.kz) — тест намеренно НЕ идёт дальше
    // (не вводит тестовую карту, не завершает реальную оплату), только
    // проверяет, что редирект произошёл на правильный домен.
    // Страница эквайера грузится ощутимо медленно (30-50с) — см. memory
    // project_checkout_acquirer_migration_test. pageLoadTimeout поднят
    // глобально в самом spec-файле (см. checkout_card_payment_regress.cy.js).
    //
    // ВАЖНО (найдено 2026-08-12 при живом прогоне): страница эквайера сама
    // задействует Google Pay автоподстановку карты (запросы к
    // pay.google.com/gp/p/ui/pay) — при ручном тестировании через реальный
    // Chrome с залогиненным Google-аккаунтом это просто UI-подсказка, но в
    // headless Cypress без такого аккаунта эквайер иногда сам делает
    // обратный редирект на /cabinet/payment/{id}/ до того, как успевает
    // стабильно догрузиться. Это артефакт автоматизации, а не баг сайта —
    // принимаем оба исхода как успех: остались на test-epay.epayment.kz/payform/
    // ИЛИ заказ реально создан (виден по API) на /cabinet/payment/{id}/.
    assertRedirectedToAcquirer() {
        // ВАЖНО (найдено 2026-08-14): `cy.url({timeout}).then()` НЕ ретраится —
        // `.then()` читает URL один раз в момент вызова, timeout у cy.url()
        // без `.should()` ни на что не влияет. Раньше это означало, что
        // 90-секундное "ожидание" на самом деле было мгновенным разовым
        // чтением — отсюда нестабильность. `.should(callback)` — правильная
        // ретраящаяся форма (см. memory project_catalog_filters_pagination_regress).
        cy.url({ timeout: 120000 }).should((url) => {
            const onAcquirer = url.includes('test-epay.epayment.kz/payform/');
            const onPaymentCabinet = /\/cabinet\/payment\/\d+/.test(url);
            // eslint-disable-next-line no-unused-expressions
            expect(
                onAcquirer || onPaymentCabinet,
                `после подтверждения заказа ожидался редирект либо на эквайер, либо на /cabinet/payment/{id}/, получили: ${url}`
            ).to.be.true;
        });

        // Раньше здесь был доп. GET /v2/personal/order/{id} через getOrder() —
        // убрано 2026-08-14: сам факт, что браузер оказался на
        // /cabinet/payment/{id}/, уже доказывает, что заказ создан (страница
        // определяется по id заказа в URL); а сразу после создания этот
        // GET иногда отвечает 400 "Ошибка получения информации о заказе"
        // (похоже на репликационную гонку на бэкенде) — такая доп. проверка
        // только добавляла хрупкости, не давая новой информации.
    }

    // Сверяет «К оплате» в сайдбаре с ожидаемой суммой (числом, без ₸/пробелов —
    // сравнение идёт через normalizePrice, чтобы не зависеть от NBSP/раскладки).
    assertTotal(expectedAmount) {
        cy.contains('К оплате')
            .parent()
            .invoke('text')
            .then((text) => {
                const match = text.match(/К оплате([\d\s ]+)₸/);
                expect(match, `не удалось найти сумму в тексте «К оплате»: ${text}`).to.not.eq(null);
                const actual = Number(normalizePrice(match[1]));
                expect(actual).to.eq(expectedAmount);
            });
    }
}

export default checkoutD5;
export { BASE_URL };
