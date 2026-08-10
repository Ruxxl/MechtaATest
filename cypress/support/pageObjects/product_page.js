import { normalizePrice, digitsOnly, normalizeWhitespace } from '../helpers/textUtils';
import { waitAndAssertStatus, waitOptional } from '../helpers/apiAssertions';

const selectors = {
    productName: '#product-name',
    official_product_sticker: '#product-official-supplier-sticker',
    discount_product_sticker: '#product-benefit-sticker',
    productName_copy_button: '#product-copy-name-button',
    product_reviews: '#product-review-count',
    only_shop_sticker: '#product-only-shop-window_desktop',
    product_final_price: '#product-final-price',
    product_base_price: '#product-base-price',
    product_chips: '#product-chips',
    product_credit: '#product-option-card-1',
    product_shops_button: '#product-shops',
    product_gift_button: '#product-gift-button',
    // Разведка 2026-08-10: добавлено новое поле "Артикул" — теперь ПЕРВАЯ строка
    // блока характеристик, из-за чего ВСЕ последующие product-characteristic-key/value
    // id сдвинулись на +1 относительно того, что было раньше (Бренд был key-1/value-1,
    // теперь key-2/value-2, и т.д.). Значение поля — НЕ отдельное mainProperties[]
    // из /product/{slug} (тот массив как был 6 записей без Артикула, так и остался),
    // а производное от корневого поля `code` ("17200007628" -> "07628"):
    // фронт берёт code.slice(6) (отбрасывает первые 6 символов), а НЕ последние 5 —
    // подтверждено мок-разведкой с укороченным code="123" -> отображается "" (пусто),
    // а не "123" (что дал бы .slice(-5)). У поля Артикул нет отдельного id для
    // значения (просто <p> внутри кнопки копирования) — берём через articleValue().
    article_product_properties_key: '#product-characteristic-key-1',
    //main properties
    brand_product_properties_name: '#product-characteristic-key-2',
    model_product_properties_name: '#product-characteristic-key-3',
    srok_garant_product_properties_name: "#product-characteristic-key-4",
    vstroyennaya_memory_main_properties_name: '#product-characteristic-key-5',
    operativ_memory_main_properties_name: '#product-characteristic-key-6',
    tip_matrica_ekrana_main_properties_name: '#product-characteristic-key-7',
    //main properties value
    brand_product_properties_value: '#product-characteristic-value-2',
    model_product_properties_value: '#product-сharacteristics-value-3',
    srok_garant_product_properties_value: '#product-сharacteristics-value-4',
    vstroyennaya_memory_main_properties_value: '#product-сharacteristics-value-5',
    operativ_memory_main_properties_value: '#product-сharacteristics-value-6',
    tip_matrica_ekrana_main_properties_value: '#product-сharacteristics-value-7'
};

class productPage {

    interceptRequests() {
        //cy.intercept('GET', '**/api/v3/product/**/alternatives').as('alternatives');
        cy.intercept('GET', '**/api/v2/header/info').as('header_info');
        cy.intercept('GET', '**/api/v2/header/cities').as('header_cities');
        cy.intercept('GET', '**/api/v2/basket').as('get_basket');
        cy.intercept('GET', '**/api/v2/user').as('user');
        cy.intercept('GET', '**/api/v2/favorites').as('favorites');
        cy.intercept('GET', '**/api/v3/catalog/menu').as('catalog_menu');
        cy.intercept('POST', '**/api/v2/mindbox/actions/catalog').as('actions_catalog');
        cy.intercept('GET', '**/api/v3/product/*').as('product');
        cy.intercept('GET', '**/api/v3/catalog/offers?**').as('offers');
        cy.intercept('GET', '**/api/v3/product/*/reviews?**').as('reviews');
        cy.intercept('GET', '**/api/v3/product/*/properties').as('properties');
        cy.intercept('GET', '**/api/v3/product/*/shipment').as('shipment');
        cy.intercept('GET', '**/api/v3/product/*/description').as('description');
        cy.intercept('GET', '**/api/v3/product/*/similar').as('similar');
        cy.intercept('GET', '**/api/v3/product/*/subdivisions').as('subdivisions');
        cy.intercept('GET', '**/api/v3/trade-in/instruction').as('trede_in_instruction');
        cy.intercept('GET', '**/api/v3/catalog/meta?**').as('catalog_meta');
        cy.intercept('GET', '**/api/v3/product/*/offers').as('product_offers');
        cy.intercept('GET', '**/api/v2/compare/small').as('compare_small');
        cy.intercept('POST', '**/api/v3/personal/view/product').as('view_product');
        cy.intercept('POST', '**/api/seo-resolve').as('seo_resolve');
    }

    wait_requests() {
        const requests = [
            //'@alternatives',
            '@header_info',
            '@header_cities',
            '@get_basket',
            '@catalog_menu',
            '@product',
            '@offers',
            '@reviews',
            '@properties',
            '@shipment',
            '@description',
            '@similar',
            '@subdivisions',
            '@trede_in_instruction',
            '@catalog_meta',
            '@compare_small',
            '@view_product',
            '@seo_resolve'
        ];

        requests.forEach(alias => {
            waitAndAssertStatus(alias.replace('@', ''), [200, 204], { timeout: 20000 });
        });

        // user — отдельная проверка
        waitAndAssertStatus('user', [200, 401]);

        // favorites — для анонимной сессии бэкенд этот запрос не отправляет
        waitOptional('favorites', { timeout: 20000, expectedStatuses: [200, 204] });
    }

    check_product_name() {

        cy.wait('@product', {
            timeout: 20000
        }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);

            const productNameApi = interception.response.body.name;

            cy.get(selectors.productName).should('have.text', productNameApi)
        })

    }

    check_official_product_sticker() {

        cy.get(selectors.official_product_sticker).should('be.visible').should('have.text', 'Официальный поставщик')

    }

    check_discount_product_sticker() {
        cy.wait('@product', {
            timeout: 20000
        }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);

            // 1. Получаем число из API (например, 70000)
            const discountApi = interception.response.body.discount;

            // 2. Используем cy.get() со строкой из объекта selectors
            cy.get(selectors.discount_product_sticker)
                .invoke('text')
                .then((text) => {
                    // 3. Очищаем текст от "Выгода", "₸" и пробелов
                    const cleanText = digitsOnly(text);

                    // 4. Сравниваем как числа
                    expect(Number(cleanText)).to.eq(Number(discountApi));
                });
        });
    }

    check_productName_copy_button() {

        cy.get(selectors.productName_copy_button).should('be.visible').wait(5000).click()

        cy.get('[data-slot="title"]').should('have.text', 'Название товара скопировано')

    }

    check_reviews() {

        cy.get(selectors.product_reviews).should('be.visible')
    }

    check_main_properties() {

        cy.wait('@product', {
            timeout: 20000
        }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);

            const mainPropertiesApi = interception.response.body.mainProperties;

            const uiSelectors = [{
                    key: selectors.brand_product_properties_name,
                    value: selectors.brand_product_properties_value
                },
                {
                    key: selectors.model_product_properties_name,
                    value: selectors.model_product_properties_value
                },
                {
                    key: selectors.srok_garant_product_properties_name,
                    value: selectors.srok_garant_product_properties_value
                },
                {
                    key: selectors.vstroyennaya_memory_main_properties_name,
                    value: selectors.vstroyennaya_memory_main_properties_value
                },
                {
                    key: selectors.operativ_memory_main_properties_name,
                    value: selectors.operativ_memory_main_properties_value
                },
                {
                    key: selectors.tip_matrica_ekrana_main_properties_name,
                    value: selectors.tip_matrica_ekrana_main_properties_value
                }
            ];

            uiSelectors.forEach((selector, index) => {
                const apiProperty = mainPropertiesApi[index];

                // Проверка name
                cy.get(selector.key)
                    .should('be.visible')
                    .invoke('text')
                    .then((text) => {
                        expect(text.trim()).to.eq(apiProperty.name);
                    });

                // Проверка value
                cy.get(selector.value)
                    .should('be.visible')
                    .invoke('text')
                    .should('not.be.empty')
                    .then((text) => {
                        expect(normalizeWhitespace(text)).to.include(normalizeWhitespace(apiProperty.value));
                    });
            });
        });
    }

    // --- Артикул (новое поле, разведка 2026-08-10) ---
    // Строка "Артикул" — та же разметка #product-property, что и у остальных
    // характеристик (см. selectors выше), но БЕЗ отдельного id у значения:
    // это <p> внутри <button> (кнопка копирования), а не самостоятельный span/a.
    // Скоупимся через родителя элемента key.
    get articleRow() {
        return cy.get(selectors.article_product_properties_key).parent();
    }

    get articleValue() {
        return this.articleRow.find('p');
    }

    get articleCopyButton() {
        return this.articleRow.find('button');
    }

    // Отображаемое значение — НЕ отдельное поле API, а code.slice(6) корневого
    // ответа /product/{slug} (см. комментарий у article_product_properties_key)
    check_article() {
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);

            const { code } = interception.response.body;
            expect(code, 'у товара должен быть указан code').to.exist;
            const expectedArticle = code.slice(6);

            cy.get(selectors.article_product_properties_key).should('have.text', 'Артикул');
            this.articleValue.should('have.text', expectedArticle);
        });
    }

    // Копирование по клику на иконку рядом со значением — тот же паттерн тоста,
    // что и у копирования названия товара (см. check_productName_copy_button),
    // но с другим текстом: "Артикул товара скопирован".
    // ВАЖНО (разведка 2026-08-10): обработчик клика висит на самой ИКОНКЕ
    // (<span class="iconify i-ph:copy-light">), а не на оборачивающей <button> —
    // клик Cypress по центру button (где обычно оказывается текст "07628", т.к.
    // flex-layout кладёт <p> раньше <span>) НИКАКОГО эффекта не даёт, тост не
    // появляется вообще (ни разу за десятки попыток, включая {force: true}).
    // Целиться нужно строго в дочерний span[class*="iconify"] — тогда тост
    // появляется стабильно. Это НЕ баг "недоверенного клика" (см. skill п.4,
    // untrusted-click limitation) — реальный клик мышью в это же место (иконку)
    // тоже срабатывает; проблема была в том, ПО ЧЕМУ именно кликать.
    check_article_copy_button() {
        this.articleCopyButton.find('span[class*="iconify"]').should('be.visible').click();
        cy.get('[data-slot="title"]').should('have.text', 'Артикул товара скопирован');
    }

    check_only_shop_sticker() {

        cy.get(selectors.only_shop_sticker).should('be.visible').should('have.text', 'На витрине')

    }

    check_product_finalPrice() {

        cy.wait('@product').then((interception) => {

            expect(interception.response.statusCode).to.eq(200);

            const finalPrice = interception.response.body.prices.finalPrice;

            cy.get(selectors.product_final_price)
                .should('be.visible')
                .invoke('text')
                .then((productPriceFromUI) => {
                    expect(normalizePrice(productPriceFromUI)).to.eq(finalPrice.toString());
                });
        })
    }

    check_product_basePrice() {

        cy.wait('@product', {
            timeout: 20000
        }).then((interception) => {

            expect(interception.response.statusCode).to.eq(200);

            const basePrice = interception.response.body.prices.basePrice;

            cy.get(selectors.product_base_price)
                .should('be.visible')
                .invoke('text')
                .then((productPriceFromUI) => {
                    expect(normalizePrice(productPriceFromUI)).to.eq(basePrice.toString());
                });
        })
    }

    check_product_fishki() {

        cy.wait('@product_offers', {
            timeout: 20000
        }).then((interception) => {

            expect(interception.response.statusCode).to.eq(200);

            const chips = interception.response.body.chips; // Например, 74

            cy.get(selectors.product_chips)
                .should('be.visible')
                .invoke('text')
                .then((productTextFromUI) => {
                    expect(digitsOnly(productTextFromUI)).to.eq(chips.toString());
                });
        });
    }

    check_vse_charakteristiki() {

        const characteristics_text = 'Характеристики, комплектация и внешний вид товара могут быть изменены производителем без предварительного уведомления и могут отличаться от указанных в каталоге интернет-магазина.'

        cy.get('#open-characteristics-modal-btn').should('be.visible')
            .should('include.text', 'Все характеристики ')
            .wait(5000)
            .click()

        cy.contains('p', characteristics_text).should('be.visible')

    }

    check_product_credit_value() {

        cy.wait('@product', {
            timeout: 20000
        }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);

            // Допустим, из API пришло число 62500
            const creditApi = interception.response.body.credit.pay_per_month;

            cy.get(selectors.product_credit)
                .should('be.visible')
                .invoke('text')
                .then((uiText) => {
                    // Сравниваем строго как числа
                    expect(Number(digitsOnly(uiText))).to.eq(Number(creditApi));
                });
        });
    }

    check_shops_button() {

        cy.wait('@subdivisions', {
            timeout: 20000
        }).then((interception) => {
            // 1. Получаем количество объектов из массива в теле ответа
            // Предположим, массив лежит в корне body или в свойстве, как в вашем дампе
            const shopsArray = interception.response.body;
            const shopsCount = shopsArray.length; // Это будет число (например, 3)

            // 2. Берем текст из кнопки в UI
            cy.get(selectors.product_shops_button)
                .should('be.visible')
                .invoke('text')
                .then((buttonText) => {
                    // 4. Сравниваем количество объектов с числом из UI
                    expect(Number(digitsOnly(buttonText))).to.eq(shopsCount);
                });
        });

    }

    check_only_shop_adresses() {

        cy.get('#product-shops').click()

        cy.wait('@subdivisions').then((interception) => {
            expect(interception.response.statusCode).to.equal(200);

            const responseData = interception.response.body;

            // 1. Фильтруем объекты
            const shopwindowItems = responseData.filter(item => item.stock === "На витрине");

            // 2. Извлекаем только адреса в отдельный массив
            const shopAddresses = shopwindowItems.map(item => item.address);

            // 3. Выводим результат для проверки в консоль Cypress
            cy.log('Адреса магазинов с витриной:', shopAddresses);

            // Если адресов нет, можно добавить проверку, чтобы тест не шел дальше вхолостую
            expect(shopAddresses).to.have.length.greaterThan(0);

            // Теперь массив shopAddresses доступен для дальнейших действий
            // Например, можно сохранить его в alias, чтобы использовать ВНЕ этого блока .then()
            cy.wrap(shopAddresses).as('targetAddresses');
        });

        // Пример использования сохраненных адресов позже в тесте:
        // Скоуп через #availabilityBlock обязателен — глобальный cy.contains(addr)
        // на этой странице задевает скрытый мобильный дубль разметки (та же
        // проблема дублирующегося DOM, что и в других местах проекта), и
        // .should('be.visible') падает на невидимом дубле, хотя видимый есть
        cy.get('@targetAddresses').then((addresses) => {
            addresses.forEach((addr) => {
                cy.contains('#availabilityBlock', addr).should('be.visible');
            });
        });
        
        cy.get('#product-free-shipping').should('have.text', 'Бесплатная доставка при покупке на сумму от 10 000 ₸')
    }

    check_express_delivery() {

        // Экспресс-доставка включается только с 12:00, поэтому expressDelivery
        // легитимно бывает false в первой половине дня — это не баг сайта,
        // сверяем UI с тем, что реально прислал API, а не требуем true всегда
        cy.wait('@shipment', {
            timeout: 20000
        }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);

            const express_delivery_api_response = interception.response.body.expressDelivery;

            if (express_delivery_api_response) {
                cy.get('#product-deliveries-1').should('be.visible')
                cy.get('#product-free-shipping').should('have.text', 'Бесплатная доставка при покупке на сумму от 10 000 ₸')
            } else {
                cy.log('ℹ️ Экспресс-доставка сейчас недоступна (до 12:00) — пропускаем проверку блока доставки');
            }
        });

    }

    check_express_delivery_text() {

        cy.get('#product-free-shipping').should('have.text', 'Бесплатная доставка при покупке на сумму от 10 000 ₸')
    }

    check_gift_button() {

        cy.wait('@product_offers', {timeout: 20000}).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);

            // Достаем внутренний массив (первый элемент массива gifts)
            const gifts_items = interception.response.body.gifts[0];

            // Проверяем, что массив не пустой, прежде чем идти дальше
            expect(gifts_items).to.be.an('array').and.not.be.empty;

            cy.get(selectors.product_gift_button).should('be.visible').click();

            gifts_items.forEach((gift) => {
                // Логируем для отладки, если вдруг тест упадет (увидите в консоли Cypress)
                cy.log(`Checking gift: ${gift.name}`);

                // Ищем текст подарка в теге span на странице
                cy.contains('span', gift.name)
                    .should('be.visible');
            });
        });
    }

    // --- Панель сопутствующих товаров после "В корзину" (TC-CART-01,02,04,06,07,08) ---
    // Разведка 2026-08-04: появляется НЕ у каждого товара — источник данных
    // /api/v3/product/{slug}/relatedWithProviderData ({categories:[{category,
    // products}], chargers, providerData:{strategyMessage}}). Панель НЕ имеет
    // role="dialog" (в отличие от модалок подарка/характеристик) — ищем по
    // заголовку "Товар добавлен в корзину". Кнопки внизу — "Продолжить" (закрывает
    // панель, остаётся на странице товара — этим одним действием покрываются оба
    // кейса плана, TC-CART-06 и TC-CART-08) и "В корзину" (ведёт на /basket/).
    interceptRelatedProducts() {
        cy.intercept('GET', '**/api/v3/product/*/relatedWithProviderData').as('relatedProducts');
    }

    waitRelatedProducts() {
        return cy.wait('@relatedProducts', { timeout: 20000 });
    }

    get crossSellPanelHeading() {
        return cy.contains('Товар добавлен в корзину');
    }

    assertCrossSellPanelShown() {
        this.crossSellPanelHeading.should('be.visible');
    }

    assertCrossSellPanelNotShown() {
        cy.contains('Товар добавлен в корзину').should('not.exist');
    }

    clickCrossSellTab(name) {
        cy.contains('button', name).click();
    }

    // Карточки в панели сопутки — кнопка "+" имеет иконку i-ph:plus. Раньше здесь
    // был cy.contains(name).parents().find('button') БЕЗ скоупа — .parents() уходит
    // до <body>, и .find('button') находит ПЕРВУЮ подходящую кнопку на всей странице
    // (не обязательно в карточке товара), из-за чего клик уходил в пустоту и
    // addToBasket не срабатывал. .parents() в Cypress/jQuery упорядочен от ближайшего
    // предка к дальнему, поэтому .filter(...).first() после него берёт САМОГО
    // БЛИЖНЕГО предка с плюс-кнопкой — то есть саму карточку товара.
    addRelatedProductByName(name) {
        cy.contains(name)
            .parents()
            .filter((i, el) => !!el.querySelector('[class*="i-ph:plus"]'))
            .first()
            .find('button')
            .filter((i, el) => !!el.querySelector('[class*="i-ph:plus"]'))
            .first()
            .click({ force: true });
    }

    // Разведка 2026-08-05: cy.contains('button', 'В корзину')/'Продолжить' по ВСЕЙ
    // странице неоднозначны, если панель открыта НЕ основной кнопкой страницы
    // (например, кликом по карточке "Похожие товары") — фоновая #product-add-to-basket
    // всё ещё показывает тот же текст "В корзину" и стоит РАНЬШЕ в DOM, чем портал
    // панели, поэтому .contains() (берёт только первое совпадение) ловит фоновую
    // кнопку. Настоящая кнопка панели найдена явным исключением id и фильтром по
    // реальной видимости; корень панели — это её 2-й родитель (<div class="fixed
    // bg-default divide-y ...">, подтверждено прямым обходом DOM), внутри которого
    // однозначно лежат и "Продолжить", и крестик закрытия.
    get crossSellPanelRoot() {
        return cy.get('button')
            .filter((i, el) => el.textContent.trim() === 'В корзину' && el.id !== 'product-add-to-basket' && el.getBoundingClientRect().width > 0)
            .first()
            .parent()
            .parent();
    }

    // ВАЖНО (разведка 2026-08-05): БЕЗ force:true и без scrollIntoView() — панель
    // сопутки position:fixed, у неё нет обычного "прокрутить и увидеть" сценария.
    // force:true отключает у Cypress ВСЕ проверки actionability разом (в т.ч.
    // "элемент не перекрыт"), из-за чего клик по кнопке, ещё не докрасившейся после
    // открытия панели (или временно перекрытой), уходил в пустоту без единой
    // ошибки в Cypress-логе — панель оставалась открытой. Сначала это выглядело
    // как реальный баг сайта (в консоли параллельно летела ошибка
    // "Cannot read properties of undefined (reading 'add')"), но настоящий клик
    // мышью в браузере закрывает панель корректно — обычный НЕ форсированный
    // click() с родным Cypress retry/actionability оказался единственно надёжным.
    clickCrossSellContinue() {
        this.crossSellPanelRoot.contains('button', 'Продолжить').click();
    }

    clickCrossSellGoToCart() {
        this.crossSellPanelRoot.contains('button', 'В корзину').click();
    }

    // Панель сопутки НЕ реагирует на Esc (не role="dialog", а боковая панель без
    // своего keydown-обработчика — в отличие от модалок подарка/характеристик/
    // галереи). Закрывается только явным крестиком, скоуп — корень панели (см. выше),
    // а не вся страница (иначе можно словить чужой X, geometrическая эвристика по
    // позиции на экране оказалась ненадёжной — один из первых вариантов этого метода
    // кликал по постороннему X и панель оставалась открытой).
    closeCrossSellPanel() {
        this.crossSellPanelRoot.find('button').filter((i, el) => !!el.querySelector('[class*="i-ph:x"]')).first().click();
    }

    // Немедленный cy.visit('/basket/') сразу после клика "В корзину" иногда
    // успевает произойти раньше, чем реально уйдёт запрос добавления (та же
    // гонка, что уже была исправлена в add_basket.js) — интерцепт+wait перед
    // переходом убирает эту гонку
    interceptAddToBasket() {
        cy.intercept('POST', '**/api/v2/basket/add').as('addToBasket');
    }

    waitAddToBasket() {
        return cy.wait('@addToBasket', { timeout: 20000 });
    }

    // --- Панель "Все характеристики" (TC-INFO-17..20,23) ---
    openCharacteristicsPanel() {
        cy.contains('button,a', 'Все характеристики').click();
    }

    // Иконки на сайте — это <span class="iconify i-ph:..."> (Iconify), НЕ <svg>,
    // поэтому поиск по querySelector('svg') всегда возвращал пустой набор
    closeCharacteristicsPanel() {
        cy.get('[role="dialog"]').find('button').filter((i, el) => !!el.querySelector('[class*="iconify"]') && el.getBoundingClientRect().width > 0).first().click({ force: true });
    }

    // Кнопки покупки внутри панели дублируют id с фоновой страницей — берём
    // видимую кнопку С НУЖНЫМ ТЕКСТОМ строго внутри диалога
    clickPanelBuyButton(label) {
        cy.get('[role="dialog"]')
            .find('button')
            .filter((i, el) => el.textContent.trim() === label && el.getBoundingClientRect().width > 0)
            .first()
            .click();
    }

    openGiftModal() {
        cy.get(selectors.product_gift_button).should('be.visible').click();
    }

    // --- Карусель "Похожие товары" (TC-SIM-01..10) ---
    // Разведка 2026-08-05: ДРУГОЙ виджет, чем /similar (тот — переключение вариантов
    // по характеристике/состоянию, уже покрыт в variant_selector.cy.js/page_blocks.cy.js).
    // Источник данных — /api/v3/product/{slug}/alternatives (products[], включая
    // ДРУГИЕ бренды — подтверждено на живом товаре: iPhone 15 → Xiaomi/Samsung в
    // выдаче). Показывается НЕ на каждом товаре (напр. отсутствует на AirPods).
    // Технически обёрнут в стороннюю Diginetica-разметку (digi-recs-type=
    // "alternatives", strategy-name), но сами данные карточек — с бэкенда mechta,
    // не с diginetica. В браузерном инструменте (chrome extension) виджет иногда
    // не рендерится вовсе — похоже на блокировку cdn.diginetica.net на уровне
    // расширения/privacy-фильтра; в Cypress/Electron рендерится стабильно.
    // DOM дублирован mobile/desktop (стандартный паттерн проекта, см. skill п.4) —
    // фильтруем по реальной видимости. У каждой карточки 4 кнопки в фиксированном
    // порядке: [0] триггер тултипа чипсы (не всегда есть), [1] сравнение
    // (i-ph:scales), [2] избранное (i-ph:heart), [3] В корзину (i-ph:shopping-cart).
    // Клик "В корзину" на карточке открывает ТУ ЖЕ панель сопутки, что и обычная
    // кнопка на странице (см. interceptRelatedProducts/waitRelatedProducts выше) —
    // relatedWithProviderData уходит для слага ДОБАВЛЕННОГО товара, а не текущей
    // страницы (подтверждено разведкой: клик на карточку iPhone 15 Black вызвал
    // relatedWithProviderData именно для .../iphone-15-128gb-black/).
    interceptAlternatives() {
        cy.intercept('GET', '**/api/v3/product/*/alternatives').as('alternatives');
    }

    waitAlternatives() {
        return cy.wait('@alternatives', { timeout: 20000 });
    }

    get similarProductsHeading() {
        return cy.contains('h2, h3', 'Похожие товары');
    }

    similarProductCards() {
        return cy.get('[product-id]').filter((i, el) => el.getBoundingClientRect().width > 0);
    }

    similarProductCard(index) {
        return this.similarProductCards().eq(index);
    }

    similarProductCardHref(index) {
        return this.similarProductCard(index).find('a[href*="/product/"]').first().invoke('attr', 'href');
    }

    clickSimilarProductLink(index) {
        this.similarProductCard(index).find('a[href*="/product/"]').first().click();
    }

    clickSimilarProductAddToCart(index) {
        this.similarProductCard(index).find('button').filter((i, el) => !!el.querySelector('[class*="i-ph:shopping-cart"]')).first().click({ force: true });
    }

    // Разведка 2026-08-05 (по просьбе пользователя): карточка похожего товара —
    // название (<a> со ссылкой на /product/{slug}/), картинка (img src содержит id
    // из images[0]), цена (span.text-no-wrap, формат "443 888 ₸" — сравниваем через
    // normalizePrice), рейтинг звёздами + счётчик отзывов. КРИТИЧНО подтверждено
    // напрямую в DOM: блок рейтинга (звёзды + число + "(N)") ВООБЩЕ НЕ рендерится,
    // если reviewsCount=0 (Vue v-if, не просто visibility:hidden) — сравнивать
    // звёзды имеет смысл только когда reviewsCount>0. Когда averageRating=0, но
    // reviewsCount>0, число перед звёздами пустое, а звёзды — серые
    // (svg.text-mi-line-generic вместо svg.text-mi-text-warning). Заполненных
    // (svg.text-mi-text-warning, видимых) звёзд ровно Math.round(averageRating) —
    // подтверждено на карточках с рейтингом 5 (5 видимых) и 0 (0 видимых, все 5
    // серые + скрытый шаблон-иконка).
    // ВАЖНО: каждая проверка ниже начинается СВОИМ вызовом similarProductCard(index),
    // а не переиспользует одну сохранённую переменную — повторные .method() на ОДНОЙ
    // и той же захваченной Cypress-цепочке продолжают её с места последней команды
    // (а не перезапускают от исходного элемента), из-за чего .contains() после
    // .and(...) получал строку вместо DOM и падал с "requires a DOM element".
    assertSimilarProductCardMatchesData(index, product) {
        this.similarProductCard(index).find('a[href*="/product/"]').first()
            .should('have.attr', 'href')
            .and('include', `/product/${product.slug}/`);
        this.similarProductCard(index).contains('a[href*="/product/"]', product.name).should('be.visible');
        this.similarProductCard(index).find('img').first().should('have.attr', 'src').and('include', product.images[0].split('/').pop());
        this.similarProductCard(index).find('[class*="text-no-wrap"]').first().invoke('text').then((text) => {
            expect(normalizePrice(text), `цена карточки товара "${product.name}"`).to.eq(String(product.prices.finalPrice));
        });
        if (product.rating.reviewsCount > 0) {
            this.similarProductCard(index).find('small.text-mi-text-secondary').should('contain.text', `(${product.rating.reviewsCount})`);
            this.similarProductCard(index).find('svg.text-mi-text-warning').filter((i, el) => el.getBoundingClientRect().width > 0)
                .should('have.length', Math.round(product.rating.averageRating));
        }
    }

    get giftModalTabs() {
        return cy.get('[role="dialog"]').contains('button', 'Выбрать подарок').closest('[role="dialog"]')
            .find('button').filter((i, el) => /Подарок\d+$/.test(el.textContent.trim()));
    }

    clickGiftModalTab(index) {
        this.giftModalTabs.eq(index).click();
    }

    selectGiftOption(index) {
        cy.get('[role="dialog"] button[role="radio"]').eq(index).click({ force: true });
    }

    confirmGiftSelection() {
        cy.get('[role="dialog"]').contains('button', 'Выбрать подарок').click();
    }

    cancelGiftSelection() {
        cy.get('[role="dialog"]').contains('button', 'Отмена').click();
    }

    // --- Негативные кейсы ---
    // Для товара без скидки/подарка/отзывов (см. fixtures/products.json -> inStock)
    // соответствующие блоки не должны рендериться в DOM вообще, а не просто быть пустыми

    assertNoDiscountSticker() {
        cy.get(selectors.discount_product_sticker).should('not.exist');
    }

    assertNoGiftButton() {
        cy.get(selectors.product_gift_button).should('not.exist');
    }

    assertNoReviewsCount() {
        cy.get(selectors.product_reviews).should('not.exist');
    }

    // --- "На витрине" (onlyShopwindow) — cypress/e2e/.../product_onlyShopwindow/ ---
    // Стикер #product-only-shop-window_desktop должен отображаться ТОГДА И ТОЛЬКО
    // ТОГДА, когда корневой ответ /product/{slug} содержит onlyShopwindow: true —
    // в отличие от check_only_shop_sticker() (который просто проверяет видимость
    // на товаре, заведомо выбранном как витринный), этот метод работает для ЛЮБОГО
    // товара и сам решает, каким должен быть результат
    assertOnlyShopwindowStickerMatchesApi() {
        cy.wait('@product', { timeout: 20000 }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);
            const onlyShopwindow = interception.response.body.onlyShopwindow;

            if (onlyShopwindow) {
                cy.get(selectors.only_shop_sticker).should('be.visible').should('have.text', 'На витрине');
            } else {
                cy.get(selectors.only_shop_sticker).should('not.exist');
            }
        });
    }

    // Внутренняя согласованность /subdivisions: там, где onlyShopwindow===true,
    // текстовая метка stock ДОЛЖНА быть "На витрине" (и наоборот) — рассинхрон
    // между этими двумя полями одного ответа это баг API уровня, независимо от UI
    assertSubdivisionsShopwindowConsistency() {
        cy.wait('@subdivisions', { timeout: 20000 }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);
            const items = interception.response.body;
            expect(items, 'у товара должен быть хотя бы один магазин в ответе').to.have.length.greaterThan(0);

            items.forEach((item) => {
                if (item.onlyShopwindow) {
                    expect(item.stock, `${item.address}: onlyShopwindow=true, но stock не 'На витрине'`).to.eq('На витрине');
                } else {
                    expect(item.stock, `${item.address}: onlyShopwindow=false, но stock='На витрине'`).to.not.eq('На витрине');
                }
            });
        });
    }

    // Чекбокс "Скрыть витрину" в блоке "Доступно на самовывоз" — кастомный
    // (button[role="checkbox"] внутри [data-slot="root"]), не нативный <input>
    get hideShopwindowCheckbox() {
        return cy.get('#product-availability-hidden-on-window');
    }

    toggleHideShopwindow() {
        this.hideShopwindowCheckbox.click({ force: true });
    }

    get storeSearchInput() {
        return cy.get('#product-availability-search-input');
    }

    searchStore(query) {
        this.storeSearchInput.clear().type(query);
    }

    assertAddressVisibleInAvailability(address) {
        cy.get('#availabilityBlock').should('contain.text', address);
    }

    // --- "Показать все магазины" (TC-STORE-06) ---
    // Разведка 2026-08-05: кнопка появляется только когда /subdivisions возвращает
    // БОЛЬШЕ магазинов, чем помещается в свёрнутый список (подтверждено: 11 магазинов
    // → видно 4 + кнопка; 5 магазинов → кнопки нет вообще, видны все сразу)
    clickShowAllStores() {
        cy.get('#availabilityBlock').contains('button', 'Показать все магазины').click();
    }

    assertAddressNotVisibleInAvailability(address) {
        cy.get('#availabilityBlock').should('not.contain.text', address);
    }

    // --- Виджет выбора варианта по характеристике (например, площадь для
    // кондиционеров) — данные из /similar. НЕ у каждого товара он есть.
    // Кнопки задублированы для mobile/desktop — фильтруем по реальной видимости.
    get variantButtons() {
        return cy.get('button').filter((i, el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && /^\d+\s*м²$/.test(el.textContent.trim());
        });
    }

    clickVariantByLabel(label) {
        this.variantButtons.contains(label).click();
    }

    // --- ОБЩИЙ вариант виджета выше — /similar генерирует группу для ЛЮБОЙ
    // характеристики, не только площади: подтверждено разведкой 2026-08-05 на
    // смартфонах — "Цвет корпуса" (type: "image", кнопки БЕЗ текста, только
    // картинка-свотч) и "Объём встроенной памяти" (type: "text"). variantButtons
    // выше не годится для картиночных групп (фильтрует по regex текста внутри
    // кнопки) — здесь скоупимся через ближайший ПОДПИСАННЫЙ заголовок группы
    // (например, "Цвет корпуса: чёрный"), а не через содержимое самих кнопок.
    // Активный вариант помечен тем же классом, что и активная миниатюра галереи
    // (border-mi-brand-base-brand-secondary, см. activeThumbnailIndicatorClass).
    getVariantGroupButtons(headingText) {
        return cy.contains('p', headingText)
            .then(($headings) => {
                // Может быть дубль mobile/desktop — берём видимый
                const $heading = $headings.filter((i, el) => Cypress.dom.isVisible(el)).first();
                return cy.wrap($heading.next()).find('button');
            });
    }

    clickVariantInGroup(headingText, index) {
        this.getVariantGroupButtons(headingText).eq(index).click();
    }

    assertActiveVariantIndexInGroup(headingText, expectedIndex) {
        this.getVariantGroupButtons(headingText).each(($btn, i) => {
            const isActive = $btn[0].className.includes('border-mi-brand-base-brand-secondary');
            expect(isActive, `кнопка варианта #${i} активна`).to.eq(i === expectedIndex);
        });
    }

    // --- Группа "Состояние" (Новый/Уценённый) — разведка 2026-08-05 на
    // iPhone 17 Pro Max 2TB: третий тип группы в /similar (type: "defective"),
    // устроен ИНАЧЕ, чем цвет/память:
    // - Заголовок в DOM ("Состояние") НЕ совпадает с group.name из API
    //   ("Уценённые") — это единственная группа, где нельзя искать по имени из API.
    // - Варианты — обычные <a href="/product/{slug}/">, а не <button> с JS-роутингом.
    // - "Новый" — это ссылка САМА НА СЕБЯ (текущий товар), которой нет в products[]
    //   ответа API (API возвращает только альтернативу — "Уценённый"). Активный
    //   вариант помечен КЛАССОМ "ring-mi-brand-line-brand!" (другой маркер, не
    //   border-mi-brand-base-brand-secondary, как у цвета/памяти).
    conditionLink(productSlug) {
        return cy.get(`a[href="/product/${productSlug}/"]`);
    }

    assertConditionLinkActive(productSlug, active) {
        this.conditionLink(productSlug).should(active ? 'have.class' : 'not.have.class', 'ring-mi-brand-line-brand!');
    }

    // --- Подсказка по бонусам/фишкам (TC-BONUS-01) ---
    // Разведка 2026-08-05: строка "+N бонусов, +N фишек" — кликабельная <section>
    // (класс содержит cursor-pointer), не иконка "?" как в исходном плане. Открывает
    // [role="dialog"] с заголовком "Программа лояльности" и текстом про оба числа.
    // ВАЖНО: внутри диалога НЕТ ссылки "Подробнее" (только безымянная кнопка-крестик
    // закрытия) — TC-BONUS-02/03 из плана (переход по ссылке, ошибка роута) описывают
    // функциональность, которой на сайте физически нет, см. README области.
    // Разведка 2026-08-05 (повторно, после падения в Cypress): на странице сразу
    // НЕСКОЛЬКО вложенных <section>, чей textContent содержит "бонус" (внешний
    // контейнер + внутренняя кликабельная секция). cy.contains(selector, text)
    // возвращает только ОДНО (первое найденное) совпадение — если это внешний
    // контейнер БЕЗ cursor-pointer, последующий .filter() всегда получает 0
    // элементов. Правильно — сначала cy.get('section') (все), потом .filter()
    // проверяет И текст, И класс на каждой из них.
    get bonusInfoTrigger() {
        return cy.get('section').filter((i, el) => /бонус/i.test(el.textContent) && el.className.includes('cursor-pointer'));
    }

    openBonusInfoModal() {
        this.bonusInfoTrigger.first().click();
    }

    // --- Сортировка отзывов (TC-REV-01..03) ---
    // Разведка 2026-08-05: id вкладок сортировки — "reka-tabs-v-0-0-1-0-trigger-{code}",
    // где {code} совпадает С КОДОМ из sorts[].code ответа /reviews (all/helpful/high/low)
    // — предсказуемый паттерн, не завязан на текст.
    clickReviewSort(code) {
        cy.get(`[id$="trigger-${code}"]`).click();
    }

    // --- Лайк/дизлайк отзыва (TC-REV-05..08) ---
    // Разведка 2026-08-05: устойчивые id "#product-review-like-{index}" /
    // "#product-review-dislike-{index}" (index — позиция отзыва на текущей странице,
    // 0-based). Один и тот же эндпоинт POST /api/v3/reviews/vote переключает голос
    // туда-обратно (тело содержит cancel:true/false) — повторный клик СНИМАЕТ голос,
    // а не меняет like на dislike. Активный голос помечен классом иконки
    // "i-ph:thumbs-up-fill"/"i-ph:thumbs-down-fill" (+ text-mi-text-complementary),
    // неактивный — "i-ph:thumbs-up"/"i-ph:thumbs-down" (+ text-mi-text-secondary).
    reviewLikeButton(index) {
        return cy.get(`#product-review-like-${index}`);
    }

    reviewDislikeButton(index) {
        return cy.get(`#product-review-dislike-${index}`);
    }

    assertReviewVoteActive(index, type, active) {
        const iconClass = type === 'like'
            ? (active ? 'i-ph:thumbs-up-fill' : 'i-ph:thumbs-up')
            : (active ? 'i-ph:thumbs-down-fill' : 'i-ph:thumbs-down');
        const selector = type === 'like' ? `#product-review-like-${index}` : `#product-review-dislike-${index}`;
        cy.get(`${selector} [class*="iconify"]`).should('have.class', iconClass);
    }

    // --- Фото в отзывах (нестандартный, в рамках TC-REV) ---
    // Разведка 2026-08-05 (по просьбе пользователя): превью фото в карточке отзыва —
    // <img src содержит apltcdn/media_files> (thumb-версия из photos[].thumb),
    // обёрнутое в <button>. Клик открывает [role="dialog"] с ПОЛНОЙ информацией:
    // название товара, большое фото, автор/дата/рейтинг отзыва, полоска миниатюр
    // (если фото несколько), текст отзыва, лайки/дизлайки, счётчик "N из M" и стрелки
    // навигации между фото ЭТОГО отзыва. Закрывается по Esc И по крестику — ОБА
    // способа реально работают, но с анимацией закрытия (~1-1.5с) — недостаточный
    // wait перед проверкой отсутствия диалога даёт ложное "не закрылось".
    // Разведка 2026-08-05: карточка отзыва целиком — это <li> (список отзывов —
    // <ul><li>...). closest('li') от кнопки лайка/дизлайка ДАЁТ ТОЧНО ту же карточку,
    // что содержит её фото — подтверждено напрямую (отзыв с 1 фото → 1 img в li,
    // отзыв с 3 фото → 3 img в li). Это НАДЁЖНЕЕ произвольного числа .parent()/.closest()
    // с угаданными классами, которые уже не раз ловили гонки/промахи в этой сессии.
    reviewCard(index) {
        return cy.get(`#product-review-like-${index}`).closest('li');
    }

    reviewPhotoThumbnails(index) {
        return this.reviewCard(index).find('img').filter((i, el) => (el.getAttribute('src') || '').match(/apltcdn|media_files/) && el.getBoundingClientRect().width > 0);
    }

    clickReviewPhotoThumbnail(index, photoIndex = 0) {
        this.reviewPhotoThumbnails(index).eq(photoIndex).closest('button').click();
    }

    get photoGalleryDialog() {
        return cy.get('[role="dialog"]');
    }

    get photoGalleryCounter() {
        return this.photoGalleryDialog.contains(/^\d+\s*из\s*\d+$/);
    }

    // Разведкой (по просьбе пользователя) подтверждено: галерея показывает ПОЛНЫЙ
    // контекст отзыва рядом с фото — рейтинг звёздами, текст отзыва, лайки/дизлайки —
    // это должно совпадать с данными ИМЕННО того отзыва, чьё фото открыли, не просто
    // "что-то на экране". Реальные селекторы (проверены напрямую в DOM, не угаданы):
    // - звёзды рейтинга — <svg class="text-mi-text-warning">, дублируются в разметке
    //   (mobile/desktop), видимые (width>0) ровно в количестве review.rating;
    // - лайк/дизлайк — <button> с дочерним <span class*="i-ph:thumbs-up/down">, число
    //   лежит текстом в самой кнопке (иконка текста не имеет, поэтому .text() кнопки
    //   == само число). Разведкой подтверждено: при счётчике 0 число ВООБЩЕ не
    //   рендерится (пустой текст кнопки) — осознанный UX (бейдж скрыт при нуле), не баг.
    assertPhotoGalleryMatchesReview(review) {
        const likesText = review.likes > 0 ? String(review.likes) : '';
        const dislikesText = review.dislikes > 0 ? String(review.dislikes) : '';
        this.photoGalleryDialog.within(() => {
            cy.contains(review.authorName).should('be.visible');
            cy.contains(review.body.slice(0, 30)).should('be.visible');
            cy.get('svg.text-mi-text-warning').filter((i, el) => el.getBoundingClientRect().width > 0)
                .should('have.length', review.rating);
            cy.get('span[class*="i-ph:thumbs-up"]').closest('button').should('have.text', likesText);
            cy.get('span[class*="i-ph:thumbs-down"]').closest('button').should('have.text', dislikesText);
        });
    }

    clickPhotoGalleryNext() {
        this.photoGalleryDialog.find('button').filter((i, el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.width < 60 && !!el.querySelector('[class*="caret-right"], [class*="arrow-right"]');
        }).first().click();
    }

    closePhotoGalleryByEsc() {
        cy.get('body').type('{esc}');
        // Анимация закрытия ~1-1.5с — недостаточный wait даёт ложное "не закрылось"
        cy.wait(1500);
    }

    get photoGalleryDialog() {
        return cy.get('[role="dialog"]');
    }

    get photoGalleryCounter() {
        return cy.contains(/^\d+\s*из\s*\d+$/);
    }

    clickPhotoGalleryNext() {
        this.photoGalleryDialog.find('button').filter((i, el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.width < 60 && !!el.querySelector('[class*="caret-right"], [class*="arrow-right"]');
        }).first().click();
    }

    closePhotoGalleryByEsc() {
        cy.get('body').type('{esc}');
        // Анимация закрытия ~1-1.5с — недостаточный wait даёт ложное "не закрылось"
        cy.wait(1500);
    }

    assertBonusInfoModalMatchesApi() {
        cy.wait('@product_offers', { timeout: 20000 }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);
            const { bonuses, chips } = interception.response.body;

            this.openBonusInfoModal();
            cy.get('[role="dialog"]').should('be.visible');
            cy.contains('Программа лояльности').should('be.visible');
            // Число разрядов разделено NBSP на странице — сравниваем по тексту без
            // пробелов вообще, а не пытаемся угадать разделитель разрядов
            cy.get('[role="dialog"]').invoke('text').then((text) => {
                const normalized = text.replace(/[\s ]/g, '');
                expect(normalized).to.include(`${bonuses}бонус`);
                expect(normalized).to.include(`${chips}фишек`);
            });
        });
    }

    // --- Описание (/description) ---
    assertDescriptionMatchesApi() {
        cy.wait('@description', { timeout: 20000 }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);
            const description = interception.response.body.description;

            if (description) {
                // Ответ может содержать HTML-разметку — сравниваем по значимому
                // фрагменту текста, а не побайтово
                const plainText = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                const snippet = plainText.slice(0, 40);
                cy.get('#product-description').should('be.visible').should('include.text', snippet);
            } else {
                cy.get('#product-description').should('not.exist');
            }
        });
    }

    // --- Отзывы: базовая математическая согласованность summary ---
    // --- Галерея изображений (TC-GAL-*) ---
    // Разведка 2026-08-04: это не "одно главное фото на замену", а горизонтальная
    // лента из ВСЕХ img сразу; активная миниатюра помечена классом
    // border-mi-brand-base-brand-secondary (у остальных его нет)
    get galleryThumbnails() {
        // Диапазон 20-90px слишком широкий — задевает иконки сравнения/избранного
        // (36/50/52px) рядом с миниатюрами. Реальные миниатюры — ровно ~74px
        // (кнопка p-2 size-22) — сужаем диапазон до 70-80, подтверждено разведкой
        return cy.get('img').filter((i, img) => {
            const rect = img.getBoundingClientRect();
            return rect.width >= 70 && rect.width <= 80 && !!img.closest('button');
        }).then(($imgs) => cy.wrap([...$imgs].map((img) => img.closest('button'))));
    }

    get activeThumbnailIndicatorClass() {
        // Хвостовой "!" — часть самого класса (конвенция Tailwind !important в
        // этом проекте, см. bg-white!/rounded-mi-xl! и т.д.), а не опечатка
        return 'border-mi-brand-base-brand-secondary!';
    }

    clickGalleryArrow(direction) {
        const iconClass = direction === 'right' ? 'i-ph:caret-right-light' : 'i-ph:caret-left-light';
        cy.get(`[class*="${iconClass}"]`).first().closest('button').click({ force: true });
    }

    openGalleryModal() {
        cy.get('img').filter((i, img) => img.getBoundingClientRect().width > 300).first().click();
    }

    // --- Избранное / Сравнение (TC-FAV-01/02, TC-CMP-01/02) ---
    // Разведка 2026-08-05: рабочие пары id — есть дублирующая мобильная версия
    // с width=0, поэтому явно уточняем _desktop. Иконки: heart/heart-fill
    // (избранное), scales/scales-fill (сравнение). Состояние реально сохраняется
    // на бэке ДАЖЕ для анонимной сессии (device-id-scoped) — POST .../add и
    // .../delete, подтверждено через cy.reload(). Первая попытка проверить это
    // через cy.request() с произвольным X-Mechta-Device-Id показала "пусто" —
    // это не баг, а моя ошибка разведки: device-id должен совпадать с тем, что
    // реально использует браузерная сессия, иначе это просто другой аноним.
    interceptFavorites() {
        cy.intercept('POST', '**/api/v3/favorites/add').as('favoriteAdd');
        cy.intercept('POST', '**/api/v3/favorites/delete').as('favoriteDelete');
    }

    interceptCompare() {
        cy.intercept('POST', '**/api/v2/compare').as('compareAdd');
        cy.intercept('POST', '**/api/v2/compare/delete').as('compareDelete');
    }

    get favoriteButton() {
        return cy.get('#product-add-to-favorite_desktop');
    }

    get compareButton() {
        return cy.get('#product-add-to-compare_desktop');
    }

    clickFavorite() {
        this.favoriteButton.click();
    }

    clickCompare() {
        this.compareButton.click();
    }

    assertFavoriteIconState(active) {
        this.favoriteButton.find('[class*="iconify"]')
            .should('have.class', active ? 'i-ph:heart-fill' : 'i-ph:heart')
            .should('not.have.class', active ? 'i-ph:heart' : 'i-ph:heart-fill');
    }

    assertCompareIconState(active) {
        this.compareButton.find('[class*="iconify"]')
            .should('have.class', active ? 'i-ph:scales-fill' : 'i-ph:scales')
            .should('not.have.class', active ? 'i-ph:scales' : 'i-ph:scales-fill');
    }

    assertReviewsSummaryConsistent() {
        cy.wait('@reviews', { timeout: 20000 }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);
            const { summary } = interception.response.body;

            const sumByStars = summary.statistics.reduce((sum, s) => sum + s.count, 0);
            expect(sumByStars, 'сумма statistics[].count должна равняться reviewsCount').to.eq(summary.reviewsCount);

            if (summary.reviewsCount > 0) {
                const weightedSum = summary.statistics.reduce((sum, s) => sum + s.rating * s.count, 0);
                const expectedAverage = Math.round((weightedSum / summary.reviewsCount) * 10) / 10;
                expect(summary.averageRating, 'averageRating должен соответствовать статистике по звёздам').to.eq(expectedAverage);
            }
        });
    }
}
export default productPage;