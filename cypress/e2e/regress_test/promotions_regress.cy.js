import CatalogPage from '../../support/pageObjects/actions/catalogPage';
import DetailPage from '../../support/pageObjects/actions/detailPage';
import {
    getAllPromotions, getPromotions, getPromotionCategories,
    getPromotionTypeMap, getPreorderProducts, findSelectableVariants,
} from '../../support/helpers/promotionsApi';
import { assertLoginModalShown } from '../../support/helpers/authModal';
import { normalizePrice } from '../../support/helpers/textUtils';

const Catalog = new CatalogPage();
const Detail = new DetailPage();

// РЕГРЕСС-тест раздела «Акции»: сквозной обход АБСОЛЮТНО ВСЕХ акций, которые сейчас
// реально опубликованы на сайте — предназначен для регулярного регрессионного
// прогона («проверить работоспособность всех акций, что есть»), а не для проверки
// конкретного отдельного сценария. Список живой: кол-во акций меняется день ото дня
// (2026-08-07 было 21) — НИКОГДА не хардкодим число, всегда получаем его из API прямо
// во время прогона через getAllPromotions(). Если конкретная акция сломается (не
// прогрузится карточка, разъедутся поля, детальная страница зависнет/упадёт) — тест
// провалится на конкретном slug, и это будет видно из сообщения ассерта/адреса.
describe('Акции — регресс: сквозной обход ВСЕХ опубликованных акций', () => {

    let allPromotions = [];
    let promotionTypeBySlug = {};
    let perPage = 10; // фолбэк на случай сбоя запроса ниже; переопределяется живым meta.perPage

    before(() => {
        getPromotions({ page: 1 }).then((res) => { perPage = res.body.meta.perPage; });
        getAllPromotions().then((list) => {
            allPromotions = list;
            cy.log(`Живой список акций на момент прогона: ${list.length} шт.`);
            expect(list.length, 'на сайте должна быть хотя бы одна акция').to.be.greaterThan(0);
        });
        getPromotionTypeMap().then((map) => { promotionTypeBySlug = map; });
    });

    it('REGR-PROMO-001: каждая карточка в списке акций 1-в-1 совпадает с ответом API (title/картинка/даты/previewText)', () => {
        // Листаем постранично через прямой URL ?page=N, а НЕ кликами по "Показать
        // еще"/номерам страниц — номера страниц пагинации, как уже известно, не
        // рендерятся в Cypress при вьюпорте 2560x1440, это единственный надёжный
        // способ достоверно долистать до карточек на всех страницах
        const totalPages = Math.ceil(allPromotions.length / perPage);
        for (let page = 1; page <= totalPages; page++) {
            Catalog.visit(page === 1 ? '' : `?page=${page}`);
            const pageSlice = allPromotions.slice((page - 1) * perPage, page * perPage);
            pageSlice.forEach((promo) => {
                Catalog.assertCardMatchesApi(promo);
            });
        }
    });

    it('REGR-PROMO-002: детальная страница каждой акции открывается, не ломается и совпадает с API (категории/баннер)', () => {
        allPromotions.forEach((promo) => {
            // ВАЖНО: категории берём ПРЯМЫМ cy.request (а не через cy.intercept
            // фронтового запроса) — при множестве cy.visit() подряд внутри одного
            // it() переиспользование одного и того же intercept-алиаса ловит гонку
            // (следующий cy.wait('@alias') может подхватить чужой, более ранний
            // запрос) — уже известный по этому проекту паттерн, воспроизведённый
            // здесь на первом же прогоне. Прямой запрос полностью её исключает.
            getPromotionCategories(promo.slug).then((res) => {
                const categoryNames = Array.isArray(res.body) ? res.body.map((c) => c.name) : [];

                Detail.visit(promo.slug);

                // Заголовок акции обязан появиться в хлебных крошках. Если страница
                // зависла в skeleton-состоянии (см. BUG-001/BUG-004) или упала, этот
                // текст никогда не появится, и тест провалится по таймауту именно на
                // этом конкретном slug — по сообщению будет видно, какая акция сломана
                cy.get('nav[aria-label="breadcrumb"]', { timeout: 15000 })
                    .should('be.visible')
                    .and('contain.text', promo.title);

                if (categoryNames.length === 0) {
                    // 0 категорий — акция чисто информационная/баннерная, каталога
                    // товаров у неё нет (подтверждено 2026-08-07 на живых акциях,
                    // напр. "10-bonusov-pri-oplate-kartoy-halyk")
                    Detail.categoryIcons.should('have.length', 0);
                } else {
                    // Категория может отрисоваться ДВУМЯ валидными способами (оба
                    // подтверждены живьём 2026-08-07): (1) обычная сетка товаров с
                    // видимыми иконками категорий — стандартный случай (см. DET-010),
                    // ЛИБО (2), когда в категории по факту всего пара товаров-вариантов
                    // ОДНОЙ модели (напр. "umnye-naushniki-s-ii-chipom" — 2 цвета одних
                    // наушников), фронт вместо сетки показывает виджет выбора параметров
                    // конкретного товара ("Выберите параметры") — тоже рабочее состояние,
                    // просто другая ветка UI, а не поломка.
                    //
                    // ВАЖНО: определяем, какая ветка отрисовалась, ЧЕРЕЗ retry-able
                    // .should() (а не одноразовый .then() без таймаута) — у акций типа
                    // "Предзаказ" виджет "Выберите параметры" подгружается ОТДЕЛЬНЫМ
                    // запросом (v2/actions/.../preorder-products) чуть позже остального
                    // контента; одноразовый снимок текста слишком рано ловит false
                    // negative и уводит проверку в неверную (стандартную) ветку —
                    // воспроизведено 2026-08-07 на "umnye-naushniki-s-ii-chipom".
                    //
                    // Сверяем совпадение по ПРЕФИКСУ названия категории, а не по
                    // полному тексту — при большом числе категорий на странице длинные
                    // названия визуально обрезаются (line-clamp/ellipsis), подтверждено
                    // на "sobiraemsya-v-shkolu" (9 категорий): "Планшеты и электронные
                    // книги" рендерится как "Планшеты и электронные...".
                    cy.get('body', { timeout: 15000 }).should(($body) => {
                        const text = $body.text();
                        const hasConfigurator = text.includes('Выберите параметры');
                        const hasCategoryHint = categoryNames.some((name) => text.includes(name.slice(0, 10)));
                        expect(
                            hasConfigurator || hasCategoryHint,
                            `${promo.slug}: ни категории (${categoryNames.join(', ')}), ни виджет выбора параметров товара не отрисовались`
                        ).to.be.true;
                    }).then(($body) => {
                        if (!$body.text().includes('Выберите параметры')) {
                            Detail.categoryIcons.should('have.length', categoryNames.length);
                        }
                    });
                }
            });

            // Баннер с кнопкой "Подробнее" есть не у каждой акции (см. DET-009 —
            // "bonusy-za-otzyv" баннера не имеет вообще), проверяем условно — но
            // если он есть, даты внутри модалки обязаны совпадать с API 1-в-1
            Detail.hasDetailsButton().then((hasBanner) => {
                if (hasBanner) {
                    Detail.assertBannerDatesMatchApi(promo);
                }
            });
        });
    });

    it('REGR-PROMO-003: сортировки списка (new/popularity/expiring) не теряют и не дублируют акции', () => {
        ['new', 'popularity', 'expiring'].forEach((sortBy) => {
            getAllPromotions({ sortBy }).then((sorted) => {
                expect(sorted, `sortBy=${sortBy}: количество акций`).to.have.length(allPromotions.length);
                const slugsSorted = sorted.map((p) => p.slug).sort();
                const slugsBase = allPromotions.map((p) => p.slug).sort();
                expect(slugsSorted, `sortBy=${sortBy}: тот же набор акций, без потерь/дублей`).to.deep.equal(slugsBase);
            });
        });
    });

    it('REGR-PROMO-004: sortBy=expiring должен сортировать по ВОЗРАСТАНИЮ daysBeforeExpiration — см. BUG-006', () => {
        // Тест целенаправленно проверяет ОЖИДАЕМОЕ поведение (акции, которые скоро
        // истекают — первыми) и должен ПАДАТЬ сейчас, пока баг не исправлен — см.
        // BugReport/Акции/BUG-006-expiring-sort-order-reversed.md. Фактически на
        // 2026-08-07 порядок был строго обратным (по убыванию, самые "долгие" акции
        // первыми, а истекающая через 2 дня — на последней странице).
        getAllPromotions({ sortBy: 'expiring' }).then((sorted) => {
            const days = sorted.map((p) => p.daysBeforeExpiration);
            const expectedAscending = [...days].sort((a, b) => a - b);
            expect(days, 'daysBeforeExpiration должен идти по возрастанию (скорее истекающие — первыми)').to.deep.equal(expectedAscending);
        });
    });

    // Акции типа "Предзаказ" рендерят СОВСЕМ другую детальную страницу, чем обычная
    // сетка категорий (см. REGR-PROMO-002) — виджет "Выберите параметры" одного
    // конкретного товара (переключатель цвета/памяти/etc.), подключённый к отдельному
    // API v2/actions/{slug}/preorder-products. Здесь — полный позитивный прогон ВСЕГО
    // функционала этого виджета (переключение параметров, фото, цена/рассрочка,
    // карусель, Trade-in, кнопка "Заказать") со сверкой по каждому полю API.
    it('REGR-PROMO-005: акции-предзаказы — полный функционал конфигуратора товара сверен с API', () => {
        const preorderPromos = allPromotions.filter((p) => promotionTypeBySlug[p.slug] === 'preorder');

        // Явная проверка, что ветка вообще что-то тестирует — если акций типа
        // "Предзаказ" сейчас нет вообще, тест должен явно упасть с понятной причиной,
        // а не молча пройти нулём итераций (тихий false positive)
        expect(preorderPromos.length, 'должна найтись хотя бы одна акция типа "Предзаказ" (иначе этот тест ничего не проверяет)').to.be.greaterThan(0);

        preorderPromos.forEach((promo) => {
            getPreorderProducts(promo.slug).then((res) => {
                const { filters, preorder_products: products } = res.body.data;
                const variants = findSelectableVariants(filters);
                expect(variants.length, `${promo.slug}: должен быть хотя бы один выбираемый вариант товара`).to.be.greaterThan(0);

                Detail.visit(promo.slug);
                cy.contains('Выберите параметры', { timeout: 15000 }).should('be.visible');

                // Баннер "Подробнее" — даты акции в модалке совпадают с /promotions
                Detail.hasDetailsButton().then((hasBanner) => {
                    if (hasBanner) {
                        Detail.assertBannerDatesMatchApi(promo);
                    }
                });

                // Переключение каждого варианта (напр. цвета корпуса) — переключает
                // ВЕСЬ блок товара разом: название/SKU, фото, цену, рассрочку —
                // 1-в-1 согласно тому, что вернул API для конкретного product_id
                variants.forEach((variant) => {
                    const product = products.find((p) => p.id === variant.product_id);
                    expect(product, `${promo.slug}: product_id ${variant.product_id} должен быть среди preorder_products`).to.exist;

                    cy.contains(variant.value).click();

                    cy.contains(product.name, { timeout: 10000 }).should('be.visible');

                    // Товарное фото — отдельный домен (www.mechta.kz/storage), в
                    // отличие от баннера акции (storage.mechta.kz) — этим и отличаем
                    // его от прочих картинок на странице (подтверждено 2026-08-07)
                    cy.get('img[src*="www.mechta.kz/storage"]')
                        .should('have.attr', 'src', product.images[0]);

                    cy.contains(/\d[\d\s]*\s?₸/).should(($el) => {
                        const prices = [...$el].map((el) => normalizePrice(el.textContent));
                        expect(prices, `${promo.slug}/${variant.value}: цена на странице`).to.include(String(product.price));
                    });

                    if (product.credit && product.credit.active) {
                        cy.contains(`${product.credit.price_in_month} ₸/мес.`).should('be.visible');
                    }
                });

                // Карусель фото — стрелки листают превью, страница не ломается
                // (полноценно у сегодняшних живых вариантов только 1 фото на товар,
                // поэтому проверяем именно "не падает", а не смену конкретной картинки).
                // ВАЖНО: условие видимости и наличия svg — ОДНИМ callback'ом в одном
                // .filter(), а не цепочкой двух .filter() подряд (".filter(':visible')
                // .filter(fn)" ломает Cypress с невнятной ошибкой "Expected to find
                // element: `filter`" — воспроизведено 2026-08-07); тот же паттерн, что
                // уже используется в detailPage.js → categoryIcons.
                cy.get('button').then(($buttons) => {
                    const arrowBtn = $buttons.filter((i, el) => {
                        const rect = el.getBoundingClientRect();
                        return !!el.querySelector('svg') && rect.width > 0 && rect.width < 60 && rect.height > 0 && rect.height < 60;
                    }).first();
                    if (arrowBtn.length) {
                        cy.wrap(arrowBtn).click({ force: true });
                        cy.get('body').should('be.visible');
                    }
                });

                // Trade-in: только структурная проверка присутствия — сам виджет
                // (сторонний Breezy Trade-In, встраивается через iframe) уже отдельно
                // и подробно покрыт в product_page/trade_in.cy.js. Разведка 2026-08-07
                // показала, что кнопка не сразу интерактивна после захода на страницу
                // (клик сразу после навигации молча ничего не открывает — вероятно,
                // виджет довешивает свой обработчик асинхронно) — это отдельный от
                // "Акций" функционал стороннего скрипта, не дублируем его тестирование
                // здесь и не полагаемся на его готовность внутри этого сквозного теста
                cy.contains('button', 'Trade-in').should('be.visible').and('not.be.disabled');

                // Кнопка "Заказать" для анонимной сессии обязана вести в модалку
                // логина, а не сразу оформлять предзаказ — тот же паттерн, что и
                // "Купить сейчас"/"Оформить заказ" в остальном сайте (authModal.js)
                cy.contains('button', 'Заказать').click();
                assertLoginModalShown();
            });
        });
    });
});
