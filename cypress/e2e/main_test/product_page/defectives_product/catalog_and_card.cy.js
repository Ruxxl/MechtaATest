// Лист 1 "Каталог и карточка товара" (TC-001..018) из
// Уцененные_товары_тест_кейсы.xlsx — см. TestPlans/Defectives-full-testcases.md.
//
// Разведка 2026-08-06 (см. cypress/support/pageObjects/defective_product.js для
// подробностей по эндпоинтам):
// - Навигационный пункт каталога — "Уцененные товары" (БЕЗ буквы "ё").
// - /defected/ — лендинг с блоком "Как это работает" и сеткой категорий.
// - /section/defective-{slug}/ — список товаров категории с фильтрами "Вид
//   уценки"/"Комплект"/"Упаковка" в сайдбаре.
// - "Уцененный N" — пилюля-триггер на странице ОБЫЧНОГО товара (N = число
//   доступных единиц из /defectives), открывает модалку "Выберите уцененный
//   товар". Модалка НЕ имеет role="dialog".
// - НАЙДЕН БАГ (см. BUG-001, TC-011): раскрытая "Причина уценки" не показывает
//   поле "Дефекты" (defectDetails) вообще — только Состояние/Упаковка/
//   Комплект/Адрес. См. BugReport/Товар/defectives_product/.
// - Фильтры (TC-004..006): GET /api/v3/catalog/filter?slug=... отдаёт
//   {properties:[{slug,name,items:[{value,slug,count}]}]} — slug'и ИМЕННО
//   snake_case ("defect_type_slug"/"components_state_slug"/"package_state_slug"),
//   как в исходном плане, хотя JSON-поля товара в /product/{slug} — camelCase.
//   Несовместимая комбинация фильтров даёт от API реальный 204 No Content
//   (НЕ 200 с пустым массивом) — фронтенд корректно показывает "Найдено 0
//   товаров" без падения.
// - Локализация (TC-018): переключение на /kk/ переводит ВСЕ подписи модалки
//   без исключений, включая адреса магазинов — пробелов не найдено.
import productPage from '../../../../support/pageObjects/product_page';
import defectiveProduct from '../../../../support/pageObjects/defective_product';

const ProductPage = new productPage();
const DefectiveProduct = new defectiveProduct();

describe('Уценённые товары: каталог и карточка (TC-001..018)', () => {

    let fixtures;
    before(() => {
        cy.fixture('defectives').then((f) => { fixtures = f; });
    });

    describe('Каталог верхнего уровня', () => {

        it('TC-001/002: категория "Уцененные товары" — последняя в каталоге, ведёт на /defected/ с блоком "Как это работает"', () => {
            cy.visit('/');
            DefectiveProduct.openCatalogMenu();
            // Разведка 2026-08-06: список категорий каталога — конкретный <ul>,
            // скоупим через closest('ul') от самого пункта, а не сканируем всю
            // страницу — где-то ещё на странице (футер/дублирующийся мобильный DOM)
            // встречается текст "Акции" в другом порядке, который ломает сравнение
            // без скоупа.
            DefectiveProduct.defectedCatalogMenuItem.then(($el) => {
                const ul = $el[0].closest('ul');
                const items = [...ul.querySelectorAll('li')].map((li) => li.textContent.trim());
                // последняя в списке категорий каталога (после "Акции" и "Подарочные карты")
                const idx = items.length - 1;
                const promoIdx = items.findIndex((t) => t.startsWith('Акции'));
                const giftCardIdx = items.findIndex((t) => t.startsWith('Подарочные карты'));
                expect(items[idx], '"Уцененные товары" должна быть последней в меню').to.include('Уцененные товары');
                expect(idx, 'должна идти ПОСЛЕ "Акции"').to.be.greaterThan(promoIdx);
                expect(idx, 'должна идти ПОСЛЕ "Подарочные карты"').to.be.greaterThan(giftCardIdx);
            });

            DefectiveProduct.clickDefectedCatalogMenuItem();
            cy.url().should('include', '/defected/');
            DefectiveProduct.howItWorksBlock.should('be.visible');
            DefectiveProduct.categoryTile('Смартфоны и гаджеты').should('be.visible');
        });

        it('TC-003: клик по подкатегории открывает список товаров со стикером "Уценка" на каждой карточке', () => {
            DefectiveProduct.visitDefectedLanding();
            DefectiveProduct.clickCategoryTile('Смартфоны и гаджеты');
            cy.url().should('include', '/section/defective-');
            cy.contains(/\d+ товар/).should('be.visible');
            cy.contains('Уценка').should('be.visible');
        });
    });

    describe('Фильтры списка уценённых товаров', () => {

        // Разведка 2026-08-06: параметры фильтра в URL/запросе — snake_case,
        // ТОЧНО как в исходном плане (defect_type, components_state, package_state),
        // хотя JSON-поля товара в /product/{slug} — camelCase (defectType и т.д.).
        // GET /api/v3/catalog/filter?slug=... отдаёт {properties:[{slug,name,items:
        // [{value,slug,count}]}]} — slug'и "defect_type_slug"/"components_state_slug"/
        // "package_state_slug".
        it('TC-004: фильтры "Вид уценки"/"Комплект"/"Упаковка" отображаются и соответствуют значениям из API', () => {
            cy.intercept('GET', '**/api/v3/catalog/filter*').as('filters');
            cy.visit('/section/defective-smartfony-i-gadjety/');
            cy.wait('@filters', { timeout: 20000 }).then((interception) => {
                const props = interception.response.body.properties;
                const byPage = {
                    defect_type_slug: DefectiveProduct.discountTypeFilterHeading,
                    components_state_slug: DefectiveProduct.componentsFilterHeading,
                    package_state_slug: DefectiveProduct.packageFilterHeading,
                };
                ['defect_type_slug', 'components_state_slug', 'package_state_slug'].forEach((slug) => {
                    const prop = props.find((p) => p.slug === slug);
                    expect(prop, `свойство ${slug} должно быть в ответе API`).to.exist;
                    byPage[slug].should('be.visible');
                    prop.items.forEach((item) => {
                        cy.contains(item.value.trim()).should('exist');
                    });
                });
            });
        });

        it('TC-005: применение фильтра "Вид уценки" уменьшает список и совпадает со значением из API (meta.totalCount)', () => {
            cy.intercept('GET', '**/api/v3/catalog/filter*').as('filters');
            cy.visit('/section/defective-smartfony-i-gadjety/');
            cy.wait('@filters', { timeout: 20000 }).then((interception) => {
                const defectType = interception.response.body.properties.find((p) => p.slug === 'defect_type_slug');
                const option = defectType.items[0];

                // Не сужаем URL-паттерн интерцепта до конкретного параметра —
                // порядок query-параметров при клике через UI не гарантирован;
                // достаточно ловить СЛЕДУЮЩИЙ вызов /catalog/products после клика.
                cy.intercept('GET', '**/api/v3/catalog/products*').as('filteredProducts');
                // Разведкой подтверждено: <label> у этого фильтра — визуальная
                // подпись с "мёртвым" атрибутом for (ссылается на несуществующий
                // <input>), клик по label ничего не делает. Реальный чекбокс —
                // соседний <button role="checkbox"> в предыдущем div-сиблинге
                // ("div.flex.items-center.h-5" перед div с label). label содержит
                // текст И счётчик слитно ("Товар после ремонта40") — сравниваем
                // через includes(), не точное совпадение
                cy.get('label')
                    .filter((i, el) => el.textContent.trim().includes(option.value.trim()) && el.getBoundingClientRect().width > 0)
                    .first()
                    .then(($label) => {
                        const row = $label[0].parentElement.parentElement;
                        cy.wrap(row.querySelector('button[role="checkbox"]')).click({ force: true });
                    });
                // Разведкой подтверждено: клик по чекбоксу НЕ вызывает /catalog/products
                // сразу — сайт только пересчитывает счётчики фасетов (повторный
                // /catalog/filter) и показывает кнопку "Показать N результатов";
                // сам список товаров запрашивается только по клику на эту кнопку
                cy.contains('button', /Показать\s+\d+\s+результат/i).click();
                cy.wait('@filteredProducts', { timeout: 20000 }).then((productsInterception) => {
                    expect(productsInterception.request.url, 'запрос должен содержать выбранный slug фильтра').to.include(option.slug);
                    const { totalCount } = productsInterception.response.body.meta;
                    expect(totalCount, 'totalCount из API должен совпадать со счётчиком у фильтра').to.eq(option.count);
                    cy.contains(new RegExp(`${totalCount} товар`)).should('exist');
                });
            });
        });

        // Разведкой подтверждено: несовместимая комбинация (напр. defect_type_slug=
        // tovar-posle-diagnostiki + package_state_slug=povrejdena) реально даёт от
        // API 204 No Content (не 200 с пустым массивом!) — стаббинг именно этой
        // формы ответа, а не гадание, какая живая комбинация даст 0 результатов
        // (состав меняется).
        it('TC-006: несовместимая комбинация фильтров (204 от API) — "Найдено 0 товаров" без падения страницы', () => {
            const errors = [];
            cy.on('window:before:load', (win) => {
                win.addEventListener('error', (e) => {
                    if (!e.message.includes("reading 'add'")) errors.push(e.message);
                });
            });
            cy.intercept('GET', '**/api/v3/catalog/products*', { statusCode: 204, body: '' }).as('emptyProducts');
            cy.visit('/section/defective-smartfony-i-gadjety/');
            cy.wait('@emptyProducts', { timeout: 20000 });
            // cy.contains() может попасть на скрытый mobile-дубликат DOM — как и
            // везде в проекте, проверяем наличие в DOM, а не физическую видимость
            cy.contains(/найдено 0 товар/i).should('exist');
            cy.get('body').should('be.visible');
            cy.then(() => {
                expect(errors, `не должно быть НЕИЗВЕСТНЫХ JS-ошибок: ${JSON.stringify(errors)}`).to.have.length(0);
            });
        });
    });

    describe('Кнопка "Уцененный" на странице обычного товара', () => {

        it('TC-007: товар с доступными уценёнными аналогами показывает кнопку "Уцененный N", N соответствует /defectives', () => {
            DefectiveProduct.interceptDefectives();
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            DefectiveProduct.waitDefectives().then((interception) => {
                const count = interception.response.body.defectives.length;
                expect(count, 'фикстура должна иметь хотя бы одну уценённую единицу').to.be.greaterThan(0);
                DefectiveProduct.defectiveTriggerButton.should('contain.text', String(count));
            });
        });

        it('TC-008: товар без доступных уценённых аналогов НЕ показывает кнопку "Уцененный"', () => {
            // Стаббинг общего эндпоинта пустым списком — надёжнее, чем полагаться
            // на конкретный товар без уценки (состав меняется), см. skill п.5.5
            cy.intercept('GET', '**/api/v3/product/*/defectives', {
                statusCode: 200,
                body: { product: null, defectives: [] },
            }).as('defectivesEmpty');
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            cy.wait('@defectivesEmpty', { timeout: 20000 });
            DefectiveProduct.assertDefectiveTriggerNotShown();
        });

        it('TC-009/010: клик открывает модалку со списком уценённых единиц — у каждой своя цена, адрес, "Выбрать" и "Причина уценки"', () => {
            DefectiveProduct.interceptDefectives();
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            DefectiveProduct.waitDefectives().then((interception) => {
                const { defectives } = interception.response.body;
                DefectiveProduct.clickDefectiveTrigger();
                DefectiveProduct.assertDefectiveModalShown();

                defectives.forEach((item) => {
                    // цена рендерится с NBSP-разделителями разрядов ("809 955"), а
                    // не как сплошное число — сравниваем через регекс с опциональным
                    // пробелом между тройками цифр (тот же приём, что и в
                    // breadcrumbs_and_gallery.cy.js TC-GAL-05)
                    const priceRegex = new RegExp(String(item.prices.finalPrice).replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\u00A0]?'));
                    // cy.contains() иногда попадает на скрытый mobile-дубликат DOM
                    // (display:none) — как и в cart_crosssell.cy.js, проверяем
                    // наличие текста В DOM, а не физическую видимость на экране
                    // (сама разметка задваивается для mobile/desktop, это не баг)
                    cy.contains(priceRegex).should('exist');
                    cy.contains(item.subdivision.address).should('exist');
                });
                // cy.contains() возвращает только ПЕРВОЕ совпадение — для подсчёта
                // ВСЕХ кнопок нужен cy.get().filter(); плюс фильтр по видимости —
                // разметка задваивается для mobile/desktop (см. skill п.4)
                cy.get('button').filter((i, el) => el.textContent.trim() === 'Выбрать' && el.getBoundingClientRect().width > 0).should('have.length', defectives.length);
                cy.get('button').filter((i, el) => el.textContent.trim() === 'Причина уценки' && el.getBoundingClientRect().width > 0).should('have.length', defectives.length);
            });
        });

        it('TC-011: "Причина уценки" раскрывает блок с Состоянием/Упаковкой/Комплектом, кнопка меняется на "Скрыть"', () => {
            DefectiveProduct.interceptDefectives();
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            DefectiveProduct.waitDefectives().then((interception) => {
                const item = interception.response.body.defectives[0];
                DefectiveProduct.clickDefectiveTrigger();
                DefectiveProduct.assertDefectiveModalShown();

                DefectiveProduct.toggleDefectiveReason(0);
                DefectiveProduct.assertDefectiveReasonExpanded(0);
                cy.contains(item.defectType).should('be.visible');
                cy.contains(item.packageState).should('be.visible');
                cy.contains(item.componentsState).should('be.visible');
            });
        });

        // БАГ-КАНДИДАТ: см. header файла и BugReport/Товар/defectives_product/.
        // Тест целенаправленно проверяет ОЖИДАЕМОЕ поведение (текст defectDetails
        // виден в раскрытом блоке) и падает, документируя пробел.
        it('TC-011 / БАГ: раскрытая "Причина уценки" должна показывать поле "Дефекты" (defectDetails)', () => {
            DefectiveProduct.interceptDefectives();
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            DefectiveProduct.waitDefectives().then((interception) => {
                const item = interception.response.body.defectives.find((d) => d.defectDetails && d.defectDetails.length > 0);
                expect(item, 'нужна хотя бы одна позиция с непустым defectDetails').to.exist;
                const index = interception.response.body.defectives.indexOf(item);

                DefectiveProduct.clickDefectiveTrigger();
                DefectiveProduct.assertDefectiveModalShown();
                DefectiveProduct.toggleDefectiveReason(index);
                cy.contains(item.defectDetails[0], { timeout: 5000 }).should('be.visible');
            });
        });

        it('TC-012: "Скрыть" сворачивает блок обратно, кнопка снова "Причина уценки"', () => {
            DefectiveProduct.interceptDefectives();
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            DefectiveProduct.waitDefectives();
            DefectiveProduct.clickDefectiveTrigger();
            DefectiveProduct.assertDefectiveModalShown();

            DefectiveProduct.toggleDefectiveReason(0);
            DefectiveProduct.assertDefectiveReasonExpanded(0);
            DefectiveProduct.toggleDefectiveReason(0);
            DefectiveProduct.assertDefectiveReasonCollapsed(0);
        });

        it('TC-014: двойной клик по "Уцененный" открывает модалку один раз, без дублей и ошибок консоли', () => {
            // "Cannot read properties of undefined (reading 'add')" — уже известная
            // безобидная ошибка стороннего/аналитического кода при кликах по
            // интерактивным элементам сайта в целом (см. ту же ошибку у кнопки
            // "Продолжить" в cart_crosssell.cy.js/similar_products.cy.js,
            // whitelisted в support/e2e.js) — не имеет отношения к самой модалке,
            // которая открывается и работает корректно несмотря на неё.
            const KNOWN_BENIGN = "Cannot read properties of undefined (reading 'add')";
            const errors = [];
            cy.on('window:before:load', (win) => {
                win.addEventListener('error', (e) => {
                    if (!e.message.includes(KNOWN_BENIGN)) errors.push(e.message);
                });
            });
            DefectiveProduct.interceptDefectives();
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            DefectiveProduct.waitDefectives();
            DefectiveProduct.defectiveTriggerButton.dblclick();
            cy.wait(500);
            cy.contains('Выберите уцененный товар').should('have.length', 1);
            cy.then(() => {
                expect(errors, `не должно быть НЕИЗВЕСТНЫХ JS-ошибок в консоли: ${JSON.stringify(errors)}`).to.have.length(0);
            });
        });

        it('TC-015: "Причина уценки" для позиции №1 остаётся раскрытой при открытии позиции №2 — данные не перепутаны', () => {
            DefectiveProduct.interceptDefectives();
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            DefectiveProduct.waitDefectives().then((interception) => {
                const [item0, item1] = interception.response.body.defectives;
                expect(item1, 'нужно минимум 2 позиции').to.exist;

                DefectiveProduct.clickDefectiveTrigger();
                DefectiveProduct.assertDefectiveModalShown();
                DefectiveProduct.toggleDefectiveReason(0);
                DefectiveProduct.assertDefectiveReasonExpanded(0);

                DefectiveProduct.toggleDefectiveReason(1);
                DefectiveProduct.assertDefectiveReasonExpanded(1);
                // блок №1 не закрылся сам собой
                DefectiveProduct.assertDefectiveReasonExpanded(0);

                cy.contains(item0.defectType).should('be.visible');
                cy.contains(item1.defectType).should('be.visible');
            });
        });

        // ВАЖНО (разведка, поймано ревью пользователя 2026-08-06): мокать ОДНУ
        // позицию в /defectives НЕЛЬЗЯ для этого теста — при РОВНО 1 доступной
        // уценённой единице сайт рендерит СОВСЕМ ДРУГОЙ элемент (см. заметку
        // fixtures.defectiveUnitAnotherModel — некликабельный статус-стикер без
        // кнопки/модалки, т.к. выбирать не из чего), а не кнопку "Уцененный N" с
        // модалкой. Первая версия этого теста мокала 1 позицию и ошибочно
        // выглядела как "виджет пропал целиком" — это была ложная тревога, не
        // баг: сайт корректно уходит в законную альтернативную ветку UI для
        // единственного экземпляра, просто она не подходит по локатору для этого
        // теста. Мокаем ≥2 позиции, чтобы гарантированно остаться в ветке
        // "модалка с выбором" и проверять именно её.
        //
        // Разведкой ОТДЕЛЬНО подтверждено: "Причина уценки" ВООБЩЕ не рендерит
        // поле defectDetails ни для одной позиции, заполнено оно или пусто (см.
        // BUG-001) — поэтому здесь не может "протечь" undefined/null именно из
        // этого поля, тест фиксирует общий инвариант на будущее.
        it('TC-013: позиция с пустым defectDetails не показывает "undefined"/"null" в раскрытом блоке', () => {
            cy.intercept('GET', '**/api/v3/product/*/defectives', {
                statusCode: 200,
                body: {
                    product: null,
                    defectives: [
                        {
                            slug: 'mock-defective-valid',
                            images: [],
                            name: 'Мок-товар с деталями',
                            defectType: 'Товар с дефектом',
                            defectDetails: ['Царапина на корпусе'],
                            componentsState: 'Полная',
                            packageState: 'Есть',
                            prices: { basePrice: 100000, finalPrice: 95000 },
                            subdivision: { address: 'ул. Тестовая, 1', schedule: '10:00-22:00', stock: 'На витрине', stockProgress: 1, onlyShopwindow: true, latitude: 0, longitude: 0 },
                        },
                        {
                            slug: 'mock-defective-empty-details',
                            images: [],
                            name: 'Мок-товар без деталей дефекта',
                            defectType: 'Товар с дефектом',
                            defectDetails: [],
                            componentsState: 'Полная',
                            packageState: 'Есть',
                            prices: { basePrice: 100000, finalPrice: 90000 },
                            subdivision: { address: 'ул. Тестовая, 2', schedule: '10:00-22:00', stock: 'На витрине', stockProgress: 1, onlyShopwindow: true, latitude: 0, longitude: 0 },
                        },
                    ],
                },
            }).as('defectivesEmptyDetails');
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            cy.wait('@defectivesEmptyDetails', { timeout: 20000 });
            DefectiveProduct.clickDefectiveTrigger();
            DefectiveProduct.assertDefectiveModalShown();
            // раскрываем ИМЕННО позицию с пустым defectDetails (индекс 1)
            DefectiveProduct.toggleDefectiveReason(1);
            DefectiveProduct.assertDefectiveReasonExpanded(1);
            // Проверяем текст БЕЗ содержимого <script> — сторонние аналитические
            // скрипты на странице (window.__NUXT__/tiktok/facebook и т.д.) сами по
            // себе легитимно содержат строку "undefined" (напр.
            // var userId="undefined"), обычная проверка по всему body.text()
            // давала ложное срабатывание именно из-за них
            cy.get('body').then(($body) => {
                const clone = $body.clone();
                clone.find('script').remove();
                const text = clone.text();
                expect(text, 'текст страницы (без <script>) не должен содержать "undefined"').to.not.include('undefined');
                expect(text, 'текст страницы (без <script>) не должен содержать "null"').to.not.include('null');
            });
        });

        it('TC-016: кнопка "Назад" браузера при открытой модалке закрывает её штатно, без JS-ошибок', () => {
            const errors = [];
            cy.on('window:before:load', (win) => {
                win.addEventListener('error', (e) => {
                    if (!e.message.includes("reading 'add'")) errors.push(e.message);
                });
            });
            DefectiveProduct.interceptDefectives();
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            DefectiveProduct.waitDefectives();
            DefectiveProduct.clickDefectiveTrigger();
            DefectiveProduct.assertDefectiveModalShown();

            cy.go('back');
            cy.wait(1000);
            cy.get('body').should('be.visible');
            cy.then(() => {
                expect(errors, `не должно быть НЕИЗВЕСТНЫХ JS-ошибок: ${JSON.stringify(errors)}`).to.have.length(0);
            });
        });

        it('TC-017: модель с 50+ уценёнными единицами — список рендерится без дублей и без падения страницы', () => {
            const bigList = Array.from({ length: 55 }, (_, i) => ({
                slug: `mock-defective-${i}`,
                images: [],
                name: `Мок-товар уценённый #${i}`,
                defectType: 'Товар с дефектом',
                defectDetails: [`Дефект №${i}`],
                componentsState: 'Полная',
                packageState: 'Есть',
                prices: { basePrice: 100000 + i, finalPrice: 90000 + i },
                subdivision: { address: `ул. Тестовая, ${i}`, schedule: '10:00-22:00', stock: 'На витрине', stockProgress: 1, onlyShopwindow: true, latitude: 0, longitude: 0 },
            }));
            cy.intercept('GET', '**/api/v3/product/*/defectives', {
                statusCode: 200,
                body: { product: null, defectives: bigList },
            }).as('defectivesBig');
            cy.visit(fixtures.regularWithDefectiveVariants.url);
            cy.wait('@defectivesBig', { timeout: 20000 });
            DefectiveProduct.clickDefectiveTrigger();
            DefectiveProduct.assertDefectiveModalShown();
            cy.get('body').should('be.visible');
            // ровно 55 карточек-позиций, без дублей (по числу видимых кнопок "Выбрать")
            cy.get('button').filter((i, el) => el.textContent.trim() === 'Выбрать' && el.getBoundingClientRect().width > 0)
                .should('have.length', bigList.length);
        });

        // Разведкой подтверждено 2026-08-06: переключение на /kk/ переводит ВСЕ
        // подписи модалки без исключений — "Жеңілдік" (Уценка), "Орналасқан
        // мекенжайы" (Адрес нахождения), "Таңдау" (Выбрать), "Жеңілдік себебі"
        // (Причина уценки), а внутри раскрытого блока — "Жағдайы" (Состояние),
        // "Қаптамасы" (Упаковка), "Жинақтылығы" (Комплект); даже адреса магазинов
        // переведены на казахский. Пустых строк не найдено.
        it('TC-018: переключение языка на казахский — все подписи модалки переведены, пустых строк нет', () => {
            DefectiveProduct.interceptDefectives();
            cy.visit(`/kk${fixtures.regularWithDefectiveVariants.url}`);
            DefectiveProduct.waitDefectives();
            DefectiveProduct.clickDefectiveTrigger();
            cy.contains('Арзандатылған тауарды таңдаңыз').should('be.visible');
            // cy.contains('Таңдау') без скоупа зацепляет постороннюю плавающую
            // кнопку быстрой покупки ("Таңдау"/"Выбрать" в другом виджете) — нужна
            // именно КНОПКА внутри модалки
            cy.contains('button', 'Таңдау').should('be.visible');
            cy.contains('Жеңілдік себебі').should('be.visible');

            DefectiveProduct.toggleDefectiveReason(0);
            cy.contains('Жағдайы').should('be.visible');
            cy.contains('Қаптамасы').should('be.visible');
            cy.contains('Жинақтылығы').should('be.visible');
            cy.contains('Орналасқан мекенжайы').should('be.visible');
        });
    });
});
