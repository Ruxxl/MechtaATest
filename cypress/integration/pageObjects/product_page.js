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
    //main properties
    brand_product_properties_name: '#product-characteristic-key-1',
    model_product_properties_name: '#product-characteristic-key-2',
    srok_garant_product_properties_name: "#product-characteristic-key-3",
    vstroyennaya_memory_main_properties_name: '#product-characteristic-key-4',
    operativ_memory_main_properties_name: '#product-characteristic-key-5',
    tip_matrica_ekrana_main_properties_name: '#product-characteristic-key-6',
    //main properties value
    brand_product_properties_value: '#product-characteristic-value-1',
    model_product_properties_value: '#product-сharacteristics-value-2',
    srok_garant_product_properties_value: '#product-сharacteristics-value-3',
    vstroyennaya_memory_main_properties_value: '#product-сharacteristics-value-4',
    operativ_memory_main_properties_value: '#product-сharacteristics-value-5',
    tip_matrica_ekrana_main_properties_value: '#product-сharacteristics-value-6'
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
            '@favorites',
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
            cy.wait(alias, {
                timeout: 20000
            }).its('response.statusCode').should('be.oneOf', [200, 204]);
        });

        // user — отдельная проверка
        cy.wait('@user')
            .its('response.statusCode')
            .should('be.oneOf', [200, 401]);
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
                    const cleanText = text.replace(/\D/g, '');

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

                // 🔹 Проверка name
                cy.get(selector.key)
                    .should('be.visible')
                    .invoke('text')
                    .then((text) => {
                        expect(text.trim()).to.eq(apiProperty.name);
                    });

                // 🔹 Проверка value
                cy.get(selector.value)
                    .should('be.visible')
                    .invoke('text')
                    .then((text) => {
                        const uiValue = text.replace(/\u00a0/g, ' ').trim();
                        const apiValue = apiProperty.value.replace(/\u00a0/g, ' ').trim();

                        expect(uiValue).to.include(apiValue);
                    });
            });
        });
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
                    const normalizedUIPrice = productPriceFromUI
                        .replace(/\s/g, '') // removes spaces & NBSPs
                        .replace('₸', '') // removes currency symbol
                        .trim();

                    expect(normalizedUIPrice).to.eq(finalPrice.toString());
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

                    const normalizedUIPrice = productPriceFromUI
                        .replace(/\s/g, '') // removes spaces & NBSPs
                        .replace('₸', '') // removes currency symbol
                        .trim();

                    expect(normalizedUIPrice).to.eq(basePrice.toString());
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

                    const normalizedUIChips = productTextFromUI.replace(/\D/g, '');

                    expect(normalizedUIChips).to.eq(chips.toString());
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
                    // Удаляем всё, кроме цифр (пробелы, ₸, /мес, &nbsp;)
                    const cleanUiValue = uiText.replace(/\D/g, '');

                    // Сравниваем строго как числа
                    expect(Number(cleanUiValue)).to.eq(Number(creditApi));
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
                    // 3. Извлекаем только цифры из текста кнопки
                    // "Доступно в 3 магазинах" -> "3"
                    const countFromUI = buttonText.replace(/\D/g, '');

                    // 4. Сравниваем количество объектов с числом из UI
                    expect(Number(countFromUI)).to.eq(shopsCount);
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
        cy.get('@targetAddresses').then((addresses) => {
            addresses.forEach((addr) => {
                cy.contains(addr).should('be.visible');
            });
        });
        
        cy.get('#product-free-shipping').should('have.text', 'Бесплатная доставка при покупке на сумму от 10 000 ₸')
    }

    check_express_delivery() {

        cy.wait('@shipment', {
            timeout: 20000
        }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);

            const express_delivery_api_response = interception.response.body.expressDelivery;
            expect(express_delivery_api_response).to.eq(true);

            if (express_delivery_api_response) {
                cy.get('#product-deliveries-1').should('be.visible')
                cy.get('#product-free-shipping').should('have.text', 'Бесплатная доставка при покупке на сумму от 10 000 ₸')
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

}
export default productPage;