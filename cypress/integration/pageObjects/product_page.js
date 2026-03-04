class productPage {
    interceptRequests() {
        cy.intercept('GET', '**/api/v3/product/**/alternatives').as('alternatives');
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
            '@alternatives',
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
            '@seo_resolve',
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

            const productName = interception.response.body.name; // название из API
            cy.log(productName)

            cy.get('h1.pt-2\\!.pr-0\\!', {
                    timeout: 20000
                }) // ← замени на реальный селектор
                .should('be.visible')
                .invoke('text')
                .then((productNameFromUI) => {
                    expect(productNameFromUI.trim()).to.eq(productName);
                });
        });

    }

    check_product_sticker() {
        cy.wait('@product', {
            timeout: 20000
        }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);

            const stickers = interception.response.body.stickers[0].name;
            cy.log(stickers)

            cy.contains('span', 'Trade-in').first()
                .should('be.visible')
                .invoke('text')
                .then((productStickerFromUI) => {
                    expect(productStickerFromUI.trim()).to.eq(stickers);
                });
        })
    }

    check_product_finalPrice() {

        cy.wait('@product', {
            timeout: 20000
        }).then((interception) => {

            expect(interception.response.statusCode).to.eq(200);

            const finalPrice = interception.response.body.prices.finalPrice;

            cy.log(finalPrice)

            cy.get('section:nth-of-type(1) > section.gap-2.flex > p.text-mi-brand-text-brand.text-mi-header-2:nth-of-type(1)')
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

            cy.log(basePrice)

            cy.get('section:nth-of-type(1) > section.gap-2.flex > p.text-mi-body-2.text-mi-text-secondary:nth-of-type(2)')
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

    check_nalichie_v_magazinah() {

        cy.wait('@shipment', {
            timeout: 20000
        }).then((interception) => {

            expect(interception.response.statusCode).to.eq(200);

            const subdivisions = interception.response.body.subdivisions;

            cy.log(subdivisions)

            cy.get('p.text-mi-body-1.text-mi-brand-text-brand')
                .should('be.visible')
                .invoke('text')
                .then((productSubdivisionsFromUI) => {

                    const uiSubdivisionsNumber = Number(
                        productSubdivisionsFromUI.replace(/\D/g, '')
                    );

                    expect(uiSubdivisionsNumber).to.eq(subdivisions);
                });
        })
    }

    check_product_na_vetrine() {

        cy.wait('@product', {
            timeout: 20000
        }).then((interception) => {

            expect(interception.response.statusCode).to.eq(200);

            const onlyShopwindow = interception.response.body.onlyShopwindow;

            cy.log(`onlyShopwindow: ${onlyShopwindow}`);

            if (onlyShopwindow) {
                // тест упадёт, если элемента нет или он скрыт
                cy.contains('span', 'На витрине').first().should('be.visible');
            } else {
                // можно добавить проверку, что элемент не виден (опционально)
                cy.contains('span', 'На витрине').first().should('not.exist');
            }
        });
    }

    check_main_properties() {
        cy.wait('@product', {
            timeout: 20000
        }).then((interception) => {
            expect(interception.response.statusCode).to.eq(200);

            const brand_name = interception.response.body.mainProperties[0].name;
            const model_name = interception.response.body.mainProperties[1].name;
            const srok_garant_name = interception.response.body.mainProperties[2].name;
            const vstroyennaya_memory_name = interception.response.body.mainProperties[3].name;
            const operativ_memory_name = interception.response.body.mainProperties[4].name;
            const tip_matrica_ekrana_name = interception.response.body.mainProperties[5].name;

            const brand_value = interception.response.body.mainProperties[0].value;
            const model_value = interception.response.body.mainProperties[1].value;
            const srok_garant_value = interception.response.body.mainProperties[2].value;
            const vstroyennaya_memory_value = interception.response.body.mainProperties[3].value;
            const operativ_memory_value = interception.response.body.mainProperties[4].value;
            const tip_matrica_ekrana_value = interception.response.body.mainProperties[5].value;

            cy.log(brand_name);
            cy.log(model_name);
            cy.log(srok_garant_name);
            cy.log(vstroyennaya_memory_name);
            cy.log(operativ_memory_name);
            cy.log(tip_matrica_ekrana_name);

            cy.log(brand_value);
            cy.log(model_value);
            cy.log(srok_garant_value);
            cy.log(vstroyennaya_memory_value);
            cy.log(operativ_memory_value);
            cy.log(tip_matrica_ekrana_value);

            // Проверка Brand
            cy.contains('span', 'Бренд').first()
                .should('be.visible')
                .invoke('text')
                .then((productBrandFromUI) => {
                    expect(productBrandFromUI.trim()).to.eq(brand_name);
                });

            // Проверка Model
            cy.contains('span', 'Модель').first()
                .should('be.visible')
                .invoke('text')
                .then((productModelFromUI) => {
                    expect(productModelFromUI.trim()).to.eq(model_name);
                });

            // Проверка Срок гарантии
            cy.contains('span', 'Срок гарантии').first()
                .should('be.visible')
                .invoke('text')
                .then((productGarantFromUI) => {
                    expect(productGarantFromUI.trim()).to.eq(srok_garant_name);
                });

            // Проверка Встроенная память
            cy.contains('span', 'Объем встроенной памяти').first()
                .should('be.visible')
                .invoke('text')
                .then((productMemoryFromUI) => {
                    expect(productMemoryFromUI.trim()).to.eq(vstroyennaya_memory_name);
                });

            // Проверка Оперативная память
            cy.contains('span', 'Объем оперативной памяти').first()
                .should('be.visible')
                .invoke('text')
                .then((productRamFromUI) => {
                    expect(productRamFromUI.trim()).to.eq(operativ_memory_name);
                });

            // Проверка Тип матрицы экрана
            cy.contains('span', 'Тип матрицы экрана').first()
                .should('be.visible')
                .invoke('text')
                .then((productMatrixFromUI) => {
                    expect(productMatrixFromUI.trim()).to.eq(tip_matrica_ekrana_name);
                });

            cy.contains('a', 'Apple').first()
                .should('be.visible')
                .invoke('text')
                .then((productBrandValueFromUI) => {
                    expect(productBrandValueFromUI.trim()).to.eq(brand_value);
                });

            cy.get('section.py-1.w-full:nth-of-type(6) > div.flex.justify-between:nth-of-type(3) > span.text-nowrap.text-right:nth-of-type(2)')
                .should('be.visible')
                .invoke('text')
                .then((productModelValueFromUI) => {
                    expect(productModelValueFromUI.trim()).to.eq(model_value);
                });

            cy.contains('span', '12 мес').first()
                .should('be.visible')
                .invoke('text')
                .then((productGarantValueFromUI) => {
                    expect(productGarantValueFromUI.trim()).to.eq(srok_garant_value);
                });

            cy.contains('span', '256 ГБ').first()
                .should('be.visible')
                .invoke('text')
                .then((productMemoryValueFromUI) => {
                    expect(productMemoryValueFromUI.trim()).to.eq(vstroyennaya_memory_value);
                });

            cy.contains('span', '8 ГБ').first()
                .should('be.visible')
                .invoke('text')
                .then((productRamValueFromUI) => {
                    expect(productRamValueFromUI.trim()).to.eq(operativ_memory_value);
                });

            cy.contains('span', 'Super Retina XDR').first()
                .should('be.visible')
                .invoke('text')
                .then((productMatrixValueFromUI) => {
                    expect(productMatrixValueFromUI.trim()).to.eq(tip_matrica_ekrana_value);
                });
        });
    }

}
export default productPage;