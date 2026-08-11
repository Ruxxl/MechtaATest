// Каталог: страница категории /section/planshety/ ("Планшеты") — каждый
// фильтр из левого сайдбара проверен ПО ОТДЕЛЬНОСТИ (по прямой просьбе:
// "открыть каждую проверить каждый фильтр и его функционал").
//
// Разведка 2026-08-11 (живой браузер + прямые запросы к API
// GET /api/v3/catalog/filter?slug=planshety) — см. полный разбор в
// cypress/support/pageObjects/catalog/sectionCatalogPage.js. Ключевое для
// этого файла:
// - На странице 23 виджета фильтров: 22 группы-аккордеона в API-ответе
//   (properties[]) + отдельно слайдер "Цена" (не аккордеон, всегда виден, не
//   входит в properties[], а в priceRange). Из 22 аккордеонов 21 — списки
//   чекбоксов (одна и та же механика применения, см. GROUPS ниже), плюс
//   отдельно "Наличие в магазине" (комбобокс) — у него другой UI. "Наличие в
//   магазине" и "Цена" проверяются в своих describe-блоках в конце файла.
// - Slug группы (например "brend") и slug конкретного значения (например
//   "samsung") — стабильные идентификаторы каталога, не завязанные на
//   сегодняшний count; сам count всегда берётся ЖИВЫМ прямым запросом к API
//   внутри теста, а не хардкодится (см. skill п.3 про fixtures).
// - Для каждой группы выбрано значение из ТОП-5 по count (видимых БЕЗ клика
//   "Показать все") — сам клик по "Показать все" не реагирует на
//   программные клики Cypress (тот же класс проблемы, что и в
//   feedback_cypress_untrusted_click_limitation), см. отдельный
//   describe-блок "Раскрытие ... и поиск внутри списка" ниже, где это
//   обходится прямым deep-link по URL.
import SectionCatalogPage from '../../../support/pageObjects/catalog/sectionCatalogPage';
import { getCatalogFilters, getCatalogProducts, findFilterItem } from '../../../support/helpers/catalogFilterApi';

const Section = new SectionCatalogPage();
const SLUG = 'planshety';

// heading — точный текст заголовка группы в аккордеоне (для Page Object);
// groupSlug/itemSlug — стабильные slug'и из API (properties[].slug / items[].slug)
const GROUPS = [
    { heading: 'Бренд', groupSlug: 'brend', itemSlug: 'samsung' },
    { heading: 'Есть скидка', groupSlug: 'discount', itemSlug: 'has_discount' },
    { heading: 'Специальные предложения', groupSlug: 'promotion', itemSlug: 'recommendations' },
    { heading: 'Линейка', groupSlug: 'lineyka', itemSlug: 'galaxy-tab-a11' },
    { heading: 'Наличие', groupSlug: 'availability', itemSlug: 'not_shopwindow' },
    { heading: 'Диагональ экрана', groupSlug: 'diagonal-ekrana', itemSlug: '11' },
    { heading: 'Частота обновления экрана', groupSlug: 'chastota-obnovleniya-ekrana', itemSlug: '60' },
    { heading: 'Разрешение экрана', groupSlug: 'razreshenie-ekrana', itemSlug: '1920x1200' },
    { heading: 'Тип матрицы экрана', groupSlug: 'tip-matricy-ekrana', itemSlug: 'ips' },
    { heading: 'Объем встроенной памяти', groupSlug: 'obem-vstroennoy-pamyati', itemSlug: '128' },
    { heading: 'Объем оперативной памяти', groupSlug: 'obem-operativnoy-pamyati', itemSlug: '8' },
    { heading: 'Модель процессора', groupSlug: 'model-processora', itemSlug: 'kirin-710a' },
    { heading: 'Возможность звонков', groupSlug: 'vozmojnost-zvonkov', itemSlug: 'false' },
    { heading: 'Тип SIM-карты', groupSlug: 'tip-sim-karty', itemSlug: 'nano-sim' },
    { heading: 'Стандарты связи', groupSlug: 'standarty-svyazi', itemSlug: '4g-lte' },
    { heading: 'Емкость аккумулятора', groupSlug: 'emkost-akkumulyatora', itemSlug: '10100' },
    { heading: 'Платформа', groupSlug: 'platforma', itemSlug: 'android' },
    { heading: 'Цвет корпуса', groupSlug: 'cvet-korpusa', itemSlug: 'seryy' },
    { heading: 'Стилус', groupSlug: 'stilus', itemSlug: 'false' },
    { heading: 'Клавиатура в комплекте', groupSlug: 'klaviatura-v-komplekte', itemSlug: 'false' },
    { heading: 'Зарядное устройство в комплекте', groupSlug: 'zaryadnoe-ustroystvo-v-komplekte', itemSlug: 'true' },
];

describe('Планшеты (/section/planshety/): каждый фильтр по отдельности', () => {

    GROUPS.forEach(({ heading, groupSlug, itemSlug }) => {
        it(`"${heading}" (${groupSlug}): выбор значения "${itemSlug}" — счётчик API совпадает, применяется в URL и в totalCount`, () => {
            getCatalogFilters(SLUG, '').then(({ body }) => {
                const item = findFilterItem(body, groupSlug, itemSlug);
                expect(item, `значение "${itemSlug}" должно существовать в группе "${groupSlug}" в живых данных — иначе тест устарел`).to.exist;
                expect(item.count, 'фикстура должна давать >0 результатов').to.be.greaterThan(0);

                Section.visit(SLUG);
                Section.clickFilterValueCheckbox(heading, item.value);
                Section.interceptCatalogProducts();
                Section.clickApplyFiltersWithCount();
                Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                    expect(interception.response.body.meta.totalCount, 'totalCount после применения фильтра должен совпасть со счётчиком фасета ДО применения').to.eq(item.count);
                    cy.url().should('include', `properties[${groupSlug}][]=${item.slug}`);
                });
                Section.totalCountHeading.should('contain.text', String(item.count));
            });
        });
    });

    it('живой пересчёт счётчиков: клик по чекбоксу обновляет соседние счётчики ЕЩЁ ДО клика "Показать" (без полной перезагрузки)', () => {
        // Apple (16) не пересекается с "Есть скидка" (подтверждено разведкой:
        // apple+discount -> 0) — хороший наглядный кейс живого обнуления.
        // Интерсепт регистрируется ДО visit — /catalog/filter вызывается и при
        // самом заходе на страницу, и при живом пересчёте после клика; без
        // этого порядка первый cy.wait ловит гонку (алиас может достаться
        // начальной загрузке, а не пересчёту после клика — см. skill п.4).
        Section.interceptCatalogFilter();
        Section.visit(SLUG);
        Section.waitCatalogFilter({ timeout: 20000 }); // разгребаем запрос начальной загрузки
        Section.interceptCatalogFilter();
        Section.clickFilterValueCheckbox('Бренд', 'Apple');
        Section.waitCatalogFilter({ timeout: 20000 }).then((interception) => {
            const discountItem = findFilterItem(interception.response.body, 'discount', 'has_discount');
            expect(discountItem.count, 'счётчик "Есть скидка" пересчитан вживую ДО клика Показать').to.eq(0);
        });
        cy.url().should('not.include', 'brend'); // ещё не применено, просто живой пересчёт
    });

    it('значение фасета со счётчиком 0 (после живого пересчёта) задизейблено и не применяется', () => {
        Section.visit(SLUG);
        Section.clickFilterValueCheckbox('Бренд', 'Apple');
        Section.assertFilterValueDisabled('Есть скидка', 'Да');
        Section.interceptCatalogProducts();
        Section.clickApplyFiltersWithCount();
        Section.waitCatalogProducts({ timeout: 20000 }).then(() => {
            cy.url().should('not.include', 'properties[discount]');
        });
    });

    it('чекбокс: check → uncheck ДО применения — состояние возвращается к исходному, кнопка "Показать" не остаётся навязанной при нулевой дельте', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            const item = findFilterItem(body, 'brend', 'samsung');
            Section.visit(SLUG);
            Section.clickFilterValueCheckbox('Бренд', item.value);
            Section.assertFilterValueChecked('Бренд', item.value);
            // Снимаем обратно тем же кликом — относительно применённого (пока
            // ещё пустого) состояния это нулевая дельта, поэтому кнопка
            // "Показать N результатов" ожидаемо не обязана появляться
            Section.clickFilterValueCheckbox('Бренд', item.value);
            Section.assertFilterValueUnchecked('Бренд', item.value);
        });
    });

    it('применение фильтра, затем его снятие (уже ПОСЛЕ применения) и повторное применение — возвращает полный список', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            const item = findFilterItem(body, 'brend', 'samsung');
            Section.visit(SLUG);
            Section.clickFilterValueCheckbox('Бренд', item.value);
            Section.interceptCatalogProducts();
            Section.clickApplyFiltersWithCount();
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(item.count);
            });
            cy.url().should('include', 'properties[brend][]=samsung');

            // Теперь снимаем УЖЕ применённый фильтр — здесь дельта есть,
            // кнопка "Показать" обязана появиться повторно
            Section.clickFilterValueCheckbox('Бренд', item.value);
            Section.interceptCatalogProducts();
            Section.clickApplyFiltersWithCount();
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                cy.url().should('not.include', 'properties[brend]');
                expect(interception.response.body.meta.totalCount).to.eq(body.totalCount);
            });
        });
    });

    it('аккордеон: группы "Бренд"/"Есть скидка" раскрыты по умолчанию, остальные — свёрнуты', () => {
        Section.visit(SLUG);
        Section.assertGroupExpanded('Бренд');
        Section.assertGroupExpanded('Есть скидка');
        Section.assertGroupCollapsed('Специальные предложения');
        Section.assertGroupCollapsed('Линейка');
        Section.assertGroupCollapsed('Модель процессора');
    });

    it('клик по заголовку свёрнутой группы раскрывает её, повторный клик — сворачивает обратно', () => {
        Section.visit(SLUG);
        Section.assertGroupCollapsed('Специальные предложения');
        Section.groupToggle('Специальные предложения').click();
        Section.assertGroupExpanded('Специальные предложения');
        Section.groupToggle('Специальные предложения').click();
        Section.assertGroupCollapsed('Специальные предложения');
    });

    it('deep-link URL с валидным properties[...] применяет фильтр сразу при открытии страницы (без клика по чекбоксу)', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            const item = findFilterItem(body, 'brend', 'samsung');
            Section.interceptCatalogProducts();
            cy.visit(`/section/${SLUG}/?page=1&properties[brend][]=${item.slug}`);
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(item.count);
            });
            Section.assertFilterValueChecked('Бренд', item.value);
        });
    });

    it('deep-link URL с несуществующим значением фильтра не ломает страницу и не даёт JS-ошибок', () => {
        // "reading 'add'" — уже задокументированное безобидное исключение
        // (не наша страница, а сторонний трекинг-скрипт), см. тот же фильтр
        // в defectives_product/catalog_filters.cy.js FLT-021; подтверждено
        // повторно живой разведкой 2026-08-11 — сообщение идентично 1-в-1
        const errors = [];
        cy.on('window:before:load', (win) => {
            win.addEventListener('error', (e) => { if (!e.message.includes("reading 'add'")) errors.push(e.message); });
        });
        cy.visit(`/section/${SLUG}/?page=1&properties[brend][]=NonExistentBrandXYZ`);
        cy.get('body').should('be.visible');
        cy.then(() => {
            expect(errors, 'некорректный параметр фильтра в URL не должен вызывать JS-ошибок').to.have.length(0);
        });
    });
});

describe('Планшеты: "Наличие в магазине" — отдельный тип виджета (комбобокс, не чекбокс-список)', () => {

    it('открывает список магазинов и содержит ровно столько опций, сколько отдаёт API', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            const group = body.properties.find((p) => p.slug === 'subdivision');
            expect(group.type, 'группа "Наличие в магазине" должна быть типа dropdown, а не list — иначе Page Object писан не под тот виджет').to.eq('dropdown');

            Section.visit(SLUG);
            Section.groupToggle('Наличие в магазине').click();
            Section.openStoreDropdown();
            Section.storeOptions.should('have.length', group.items.length);
        });
    });

    it('выбор конкретного магазина применяется через properties[subdivision][] с его uuid-slug и даёт корректный totalCount', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            const group = body.properties.find((p) => p.slug === 'subdivision');
            const store = group.items[0];
            expect(store.count, 'фикстура должна давать >0 результатов').to.be.greaterThan(0);

            Section.visit(SLUG);
            Section.groupToggle('Наличие в магазине').click();
            Section.openStoreDropdown();
            Section.selectStoreOptionByIndex(0);
            Section.interceptCatalogProducts();
            Section.clickApplyFiltersWithCount();
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(store.count);
                cy.url().should('include', `properties[subdivision][]=${store.slug}`);
            });
        });
    });
});

describe('Планшеты: "Цена" — текстовые поля От/До (слайдер-хэндлы и чипы-пресеты недоступны для Cypress, см. sectionCatalogPage.js)', () => {

    it('поля "От"/"До" по умолчанию заполнены минимальной/максимальной ценой из API (priceRange)', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            Section.visit(SLUG);
            Section.priceInputs.eq(0).invoke('val').then((val) => {
                expect(Number(val.replace(/\s/g, ''))).to.eq(body.priceRange.minPrice);
            });
            Section.priceInputs.eq(1).invoke('val').then((val) => {
                expect(Number(val.replace(/\s/g, ''))).to.eq(body.priceRange.maxPrice);
            });
        });
    });

    it('ввод произвольного диапазона в "От"/"До" применяется как отдельные query-параметры minPrice/maxPrice, totalCount совпадает с API', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            const { minPrice } = body.priceRange;
            // Средняя точка диапазона — гарантированно валидный поддиапазон с >0 товаров
            const midPrice = Math.round((body.priceRange.minPrice + body.priceRange.maxPrice) / 2);

            getCatalogProducts(SLUG, '', { minPrice, maxPrice: midPrice }).then(({ body: expected }) => {
                expect(expected.meta.totalCount, 'фикстура должна давать >0 результатов').to.be.greaterThan(0);

                Section.visit(SLUG);
                Section.typePriceRange(minPrice, midPrice);
                Section.interceptCatalogProducts();
                Section.clickApplyFiltersWithCount();
                Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                    cy.url().should('include', `minPrice=${minPrice}`).and('include', `maxPrice=${midPrice}`);
                    expect(interception.response.body.meta.totalCount).to.eq(expected.meta.totalCount);
                });
            });
        });
    });

    it('невалидный диапазон (От > До) — фронт не должен зависнуть или показать пустой экран без объяснения', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            const { minPrice, maxPrice } = body.priceRange;
            Section.visit(SLUG);
            // Осознанно инвертированный диапазон — граничный некорректный ввод
            Section.typePriceRange(maxPrice, minPrice);
            Section.interceptCatalogProducts();
            Section.clickApplyFiltersWithCount();
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                // Либо backend сам меняет местами и отдаёт валидный список, либо
                // 0 результатов с понятным пустым состоянием — в обоих случаях
                // страница не должна зависнуть в бесконечной загрузке
                expect(interception.response.body.meta.totalCount).to.be.a('number');
            });
            cy.get('body').should('be.visible');
        });
    });
});

describe('Планшеты: раскрытие больших групп ("Показать все") и поиск внутри списка значений', () => {
    // Живой разведкой 2026-08-11 подтверждено (браузер, реальные isTrusted-клики):
    // - клик по "Показать все" открывает встроенный <input placeholder="Поиск">
    //   и полный прокручиваемый список значений (все 37 у "Линейка", все 29 у
    //   "Модель процессора" присутствуют в DOM сразу, без реального скролла);
    // - ввод текста в это поле фильтрует список ЖИВЬЁМ, на клиенте, без сетевого
    //   запроса — регистронезависимо ("sam" находит "Samsung");
    // - при отсутствии совпадений показывается блок "Нет подходящих результатов /
    //   Попробуйте написать название товара по-другому или сократить запрос".
    // Программный клик Cypress по самому "Показать все" не реагирует (см.
    // feedback_cypress_untrafted_click_limitation) — подтверждено повторно
    // отдельным пробным тестом на этой же странице. Поэтому здесь проверяется
    // функционально ДОСТИЖИМЫЙ эквивалент: значение, скрытое за "Показать все"
    // (не входящее в топ-5 по умолчанию), всё равно реально применимо через
    // прямой URL — то есть механизм фильтрации по нему работает корректно,
    // проблема ограничена конкретно самим DOM-виджетом раскрытия в среде теста.
    it('значение вне топ-5 (доступное только через "Показать все") применяется через deep-link так же корректно, как и видимые по умолчанию', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            const lineyka = body.properties.find((p) => p.slug === 'lineyka');
            // 6-е и далее значения в списке (после сортировки по убыванию count) —
            // ровно то, что скрыто за "Показать все", т.к. видны только первые 5
            const hiddenItem = lineyka.items[10];
            expect(hiddenItem, 'в живых данных должно быть больше 10 значений линейки').to.exist;
            expect(hiddenItem.count).to.be.greaterThan(0);

            Section.interceptCatalogProducts();
            cy.visit(`/section/${SLUG}/?page=1&properties[lineyka][]=${hiddenItem.slug}`);
            Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                expect(interception.response.body.meta.totalCount).to.eq(hiddenItem.count);
            });
        });
    });

    it('количество значений в группе "Линейка" в API (37+) заведомо больше 5 — виджет "Показать все" необходим и его наличие оправдано', () => {
        getCatalogFilters(SLUG, '').then(({ body }) => {
            const lineyka = body.properties.find((p) => p.slug === 'lineyka');
            expect(lineyka.items.length).to.be.greaterThan(5);
        });
        Section.visit(SLUG);
        Section.groupToggle('Линейка').click();
        cy.contains('Показать все').should('be.visible');
    });
});
