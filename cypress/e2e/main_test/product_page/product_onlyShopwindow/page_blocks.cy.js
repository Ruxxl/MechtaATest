import productPage from '../../../../support/pageObjects/product_page';
import { digitsOnly } from '../../../../support/helpers/textUtils';

const ProductPage = new productPage();

// Полная проверка блоков страницы товара "На витрине" (cypress/fixtures/products.json
// -> onlyShopwindow), сверенных с соответствующими API. Часть проверок пересекается
// с cypress/e2e/main_test/product_page.cy.js (по просьбе — эта папка тестирует
// страницу целиком, заякорившись именно на витринном товаре), часть — новое покрытие
// по TestPlans/PDP-product-page-testplan.md (бонусы, полный список характеристик,
// виджет вариантов, описание, согласованность отзывов).
describe('Страница товара "На витрине": блоки страницы ↔ API', () => {

    let products;
    before(() => {
        cy.fixture('products').then((p) => { products = p; });
    });

    describe('Название, стикеры, характеристики', () => {

        it('ПОЗИТИВ: название товара совпадает с API', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_product_name();
        });

        it('ПОЗИТИВ: стикер "Официальный поставщик" виден', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_official_product_sticker();
        });

        it('ПОЗИТИВ: основные характеристики (топ-6) совпадают с mainProperties из API', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_main_properties();
        });

        it('ПОЗИТИВ: кнопка "Все характеристики" открывает панель с дисклеймером', () => {
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_vse_charakteristiki();
        });
    });

    describe('Цена, скидка, бонусы', () => {

        it('ПОЗИТИВ: цена со скидкой (finalPrice) совпадает с API', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_product_finalPrice();
        });

        it('ПОЗИТИВ: цена без скидки (basePrice) совпадает с API', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_product_basePrice();
        });

        it('ПОЗИТИВ: стикер "Выгода N ₸" совпадает с полем discount из API', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_discount_product_sticker();
        });

        it('ПОЗИТИВ: количество фишек (chips) совпадает с /offers', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_product_fishki();
        });

        it('ПОЗИТИВ (новое покрытие): количество начисляемых бонусов совпадает с bonuses из /offers', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@product_offers', { timeout: 20000 }).then((interception) => {
                expect(interception.response.statusCode).to.eq(200);
                const { bonuses } = interception.response.body;
                // UI форматирует число с пробелом как разделителем разрядов
                // ("2 849"), поэтому сравниваем очищенные от нецифровых символов
                // значения, а не подставляем число в регулярку напрямую
                cy.contains('бонус')
                    .invoke('text')
                    .then((text) => {
                        expect(Number(digitsOnly(text))).to.eq(bonuses);
                    });
            });
        });

        it('ПОЗИТИВ: значение рассрочки/кредита в мес. совпадает с API', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_product_credit_value();
        });

        it('НЕГАТИВ: у этого товара gifts/bundles пусты (null) — кнопка подарка и виджет комплектов не отображаются', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@product_offers', { timeout: 20000 }).then((interception) => {
                const { gifts, bundles } = interception.response.body;
                expect(gifts, 'фикстура: у этого товара gifts должен быть null').to.be.null;
                expect(bundles, 'фикстура: у этого товара bundles должен быть null').to.be.null;
            });
            ProductPage.assertNoGiftButton();
        });
    });

    describe('Способ доставки', () => {

        it('ПОЗИТИВ: количество магазинов самовывоза совпадает с /subdivisions', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_shops_button();
        });

        it('ПОЗИТИВ (перекрёстная проверка): subdivisions в /shipment совпадает с .length ответа /subdivisions', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@shipment', { timeout: 20000 }).then((shipmentInterception) => {
                const declaredCount = shipmentInterception.response.body.subdivisions;
                cy.wait('@subdivisions', { timeout: 20000 }).then((subdivisionsInterception) => {
                    expect(subdivisionsInterception.response.body).to.have.length(declaredCount);
                });
            });
        });

        it('ПОЗИТИВ: текст доставки ("Завтра"/"Сегодня") соответствует todayDelivery из /shipment', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@shipment', { timeout: 20000 }).then((interception) => {
                expect(interception.response.statusCode).to.eq(200);
                const { todayDelivery } = interception.response.body;
                const expectedText = todayDelivery ? 'Сегодня' : 'Завтра';
                cy.contains('#product-deliveries-1', expectedText).should('be.visible');
            });
        });

        it('НЕГАТИВ: expressDelivery=false у этого товара — блок экспресс-доставки не отображается', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@shipment', { timeout: 20000 }).then((interception) => {
                expect(interception.response.body.expressDelivery, 'фикстура: у этого товара expressDelivery=false').to.eq(false);
            });
            cy.contains('Экспресс доставка').should('not.exist');
        });

        it('ПОЗИТИВ: адреса всех магазинов самовывоза кликом кнопки отображаются на странице', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_only_shop_adresses();
        });
    });

    describe('Виджет выбора варианта (площадь помещения, /similar)', () => {

        it('ПОЗИТИВ: видимые кнопки вариантов совпадают со значениями property из /similar', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@similar', { timeout: 20000 }).then((interception) => {
                const body = interception.response.body;
                expect(body, 'фикстура: у этого товара должен быть непустой /similar').to.have.length.greaterThan(0);
                const values = body[0].products.map((p) => p.property);

                values.forEach((value) => {
                    ProductPage.variantButtons.contains(value).should('be.visible');
                });
            });
        });

        it('ПОЗИТИВ: ровно один вариант отмечен как текущий, и это значение из mainProperties текущего товара', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@similar', { timeout: 20000 }).then((interception) => {
                const current = interception.response.body[0].products.filter((p) => p.isCurrent);
                expect(current, 'должен быть ровно один текущий вариант').to.have.length(1);

                cy.wait('@product', { timeout: 20000 }).then((productInterception) => {
                    // Название группы в /similar ("Площадь обслуживаемого помещения")
                    // и название соответствующего поля в mainProperties ("Рекомендуемая
                    // площадь помещения") отличаются дословно — подтверждено 2026-08-04 —
                    // поэтому сверяем по ЗНАЧЕНИЮ (оно у обоих одинаковое, "21 м²"),
                    // а не по точному совпадению названия поля
                    const areaProperty = productInterception.response.body.mainProperties
                        .find((p) => p.value === current[0].property);
                    expect(areaProperty, `mainProperties должен содержать значение "${current[0].property}"`).to.exist;
                });
            });
        });

        it('НЕСТАНДАРТНЫЙ: клик по другому варианту переводит на страницу этого варианта', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            cy.wait('@similar', { timeout: 20000 }).then((interception) => {
                const other = interception.response.body[0].products.find((p) => !p.isCurrent);
                expect(other, 'должен быть хотя бы один альтернативный вариант').to.exist;

                ProductPage.clickVariantByLabel(other.property);
                cy.url().should('include', other.slug);
            });
        });
    });

    describe('Описание', () => {

        it('ПОЗИТИВ: описание товара отображается и совпадает с началом текста из /description', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.assertDescriptionMatchesApi();
        });
    });

    describe('Отзывы: базовая согласованность', () => {

        it('ПОЗИТИВ: количество отзывов совпадает с /reviews, счётчик виден', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.check_reviews();
        });

        it('ПОЗИТИВ: сумма statistics[].count по звёздам равна reviewsCount, averageRating согласован', () => {
            ProductPage.interceptRequests();
            cy.visit(products.onlyShopwindow.url);
            ProductPage.assertReviewsSummaryConsistent();
        });
    });

    describe('Нестандартные / типовые баги (см. skill п.6)', () => {

        it('RACE: быстрый двойной клик "В корзину" добавляет товар РОВНО ОДИН раз (не дублирует строку)', () => {
            cy.visit(products.onlyShopwindow.url);
            cy.get('#product-add-to-basket').dblclick();
            cy.visit('/basket/');
            cy.contains('1 товар').should('be.visible');
            cy.get('[class*="quantity" i] input, input[type="number"]').should(($el) => {
                if ($el.length) expect(Number($el.val())).to.eq(1);
            });
            // Возвращаем корзину в исходное (пустое) состояние
            cy.get('body').then(($body) => {
                const trash = $body.find('[class*="i-ph:trash"]');
                if (trash.length) cy.wrap(trash.first()).click();
            });
        });

        it('ПОЗИТИВ (кнопки покупки): "В корзину" и "Купить сейчас" видны и кликабельны для витринного товара', () => {
            cy.visit(products.onlyShopwindow.url);
            cy.get('#product-add-to-basket').should('be.visible').should('include.text', 'В корзину').should('not.be.disabled');
            cy.get('#product-buy-now').should('be.visible').should('include.text', 'Купить сейчас').should('not.be.disabled');
        });
    });
});
