import SectionCatalogPage from '../../support/pageObjects/catalog/sectionCatalogPage';
import { getCatalogFilters, getCatalogProducts } from '../../support/helpers/catalogFilterApi';

const Section = new SectionCatalogPage();

// РЕГРЕСС-тест каталожных фильтров: ОДИН файл, параметризованный по 4
// категориям. "planshety" уже подробно (по каждой группе отдельно) покрыт в
// main_test/catalog/planshety_filters_*.cy.js; personalnye-kompyutery /
// multimediynye-monobloki / smartfony добавлены 2026-08-11 после живого
// браузерного аудита их фильтров (см. память
// project_catalog_filter_values_content_audit — там же найденные проблемы
// СОДЕРЖИМОГО значений: хаотичный нейминг USB-портов, числовые фильтры
// отсортированы по популярности вместо значения и т.п. — это чинится на
// стороне каталога/MDM, багрепорты на это осознанно НЕ заводятся, см. память).
//
// Задача ЭТОГО файла — не содержимое значений, а сам МЕХАНИЗМ фильтрации,
// который должен остаться рабочим при любых правках каталога:
// - клик по чекбоксу → живой пересчёт соседних фасетов → кнопка
//   "Показать N результатов" → реальный рефетч с правильным totalCount и URL;
// - AND-комбинация 2 групп (сужает выборку либо, при нулевом пересечении,
//   блокирует чекбокс — а не ломает страницу);
// - сброс фильтров чистым URL возвращает полную выборку;
// - "Наличие в магазине" — отдельный тип виджета (комбобокс).
// Каждое ожидаемое число — живой запрос к реальному API внутри теста (см.
// skill п.3 про fixtures), никогда не хардкод.
//
// ВАЖНО (по прямой просьбе, 2026-08-11): totalCount, который совпал, — это
// необходимое, но НЕ достаточное доказательство, что фильтр реально
// отработал (можно случайно словить "правильное число, неправильная
// выборка"). Поэтому там, где это дёшево, тест 001/002 идёт на уровень ниже
// самого totalCount: (а) КАЖДЫЙ товар в самом API-ответе действительно имеет
// применённый бренд/скидку (mainProperties/discount), а не просто попал в
// нужное количество; (б) это же реально ОТРИСОВАНО на странице — число
// уникальных карточек в DOM совпадает, и конкретный товар из ответа виден
// по своей ссылке `/product/{slug}/`, а не только присутствует в сетевом
// логе. Подтверждено живой разведкой 2026-08-11: на /section/
// personalnye-kompyutery/?properties[brend][]=xg каждый товар в ответе имеет
// mainProperties {name:"Бренд", value:"XG"}, и unique-count карточек в DOM
// (10) точно совпал с totalCount API — тот же паттерн проверен для
// смартфонов/моноблоков/планшетов.
//
// Используются только группы, гарантированно присутствующие во ВСЕХ 4
// категориях (brend/discount/subdivision) — так один файл переживает то, что
// у каждой категории свой уникальный набор остальных групп (HDMI у моноблоков,
// диагональ экрана у планшетов/смартфонов и т.д.), не привязываясь к
// конкретным значениям, которые коллега сейчас правит в каталоге.
const CATEGORIES = [
    { slug: 'planshety', label: 'Планшеты' },
    { slug: 'personalnye-kompyutery', label: 'Персональные компьютеры' },
    { slug: 'multimediynye-monobloki', label: 'Моноблоки' },
    { slug: 'smartfony', label: 'Смартфоны' },
];

CATEGORIES.forEach(({ slug, label }) => {
    describe(`Каталог: фильтры «${label}» (/section/${slug}/) — РЕГРЕСС механизма`, () => {

        it(`REGR-FILTER-${slug}-001: "Бренд" — топ-значение по count применяется корректно (счётчик, URL, totalCount)`, () => {
            getCatalogFilters(slug, '').then(({ body: filterBody }) => {
                const brandGroup = filterBody.properties.find((p) => p.slug === 'brend');
                const top = brandGroup.items[0];

                getCatalogProducts(slug, '', { properties: { brend: [top.slug] } }).then(({ body: productsBody }) => {
                    const expectedCount = productsBody.meta.totalCount;

                    Section.visit(slug);
                    Section.clickFilterValueCheckbox(brandGroup.name, top.value);
                    // живой пересчёт до применения — счётчик рядом со значением
                    // (это первый клик на чистой странице, поэтому он равен своему же count)
                    Section.assertFilterValueCountText(brandGroup.name, top.value, String(top.count));

                    Section.interceptCatalogProducts();
                    Section.clickApplyFiltersWithCount();
                    Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                        const { products, meta } = interception.response.body;
                        expect(meta.totalCount).to.eq(expectedCount);
                        cy.url().should('include', `properties[${brandGroup.slug}][]=${top.slug}`);

                        // не только совпавшее число — КАЖДЫЙ товар в ответе
                        // реально имеет применённый бренд
                        products.forEach((product) => {
                            const brandProp = product.mainProperties.find((mp) => mp.name === brandGroup.name);
                            expect(brandProp && brandProp.value, `товар "${product.name}" должен иметь бренд "${top.value}"`).to.eq(top.value);
                        });

                        // и это реально отрисовано на странице, не только в сетевом логе
                        Section.assertRenderedProductCount(Math.min(expectedCount, 24));
                        cy.get(`a[href="/product/${products[0].slug}/"]`).should('exist');
                    });
                });
            });
        });

        it(`REGR-FILTER-${slug}-002: "Бренд" + "Есть скидка" — AND-комбинация либо корректно сужает, либо (нулевое пересечение) блокирует чекбокс`, () => {
            getCatalogFilters(slug, '').then(({ body: filterBody }) => {
                const brandGroup = filterBody.properties.find((p) => p.slug === 'brend');
                const discountGroup = filterBody.properties.find((p) => p.slug === 'discount');
                const topBrand = brandGroup.items[0];
                const discountItem = discountGroup.items[0];

                getCatalogProducts(slug, '', {
                    properties: { brend: [topBrand.slug], discount: [discountItem.slug] },
                    failOnStatusCode: false,
                }).then((res) => {
                    // нулевое пересечение отдаёт 204 без тела — не "0 в meta"
                    const bothCount = res.status === 204 ? 0 : res.body.meta.totalCount;

                    Section.visit(slug);
                    Section.clickFilterValueCheckbox(brandGroup.name, topBrand.value);

                    if (bothCount === 0) {
                        Section.assertFilterValueDisabled(discountGroup.name, discountItem.value);
                        return;
                    }

                    Section.clickFilterValueCheckbox(discountGroup.name, discountItem.value);
                    Section.interceptCatalogProducts();
                    Section.clickApplyFiltersWithCount();
                    Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                        const { products, meta } = interception.response.body;
                        expect(meta.totalCount).to.eq(bothCount);

                        // не только совпавшее число — КАЖДЫЙ товар реально
                        // удовлетворяет ОБОИМ условиям одновременно (И, не ИЛИ)
                        products.forEach((product) => {
                            const brandProp = product.mainProperties.find((mp) => mp.name === brandGroup.name);
                            expect(brandProp && brandProp.value, `товар "${product.name}" должен иметь бренд "${topBrand.value}"`).to.eq(topBrand.value);
                            expect(product.discount, `товар "${product.name}" должен иметь скидку`).to.be.greaterThan(0);
                        });

                        Section.assertRenderedProductCount(Math.min(bothCount, 24));
                    });
                });
            });
        });

        it(`REGR-FILTER-${slug}-003: сброс — переход на чистый URL после применённого фильтра возвращает полную выборку категории`, () => {
            getCatalogFilters(slug, '').then(({ body: filterBody }) => {
                const brandGroup = filterBody.properties.find((p) => p.slug === 'brend');
                const top = brandGroup.items[0];

                getCatalogProducts(slug, '').then(({ body: fullBody }) => {
                    const fullCount = fullBody.meta.totalCount;

                    Section.visit(slug, `?properties[${brandGroup.slug}][]=${top.slug}`);
                    Section.totalCountHeading.should('contain.text', String(top.count));

                    Section.visit(slug); // чистый URL, без query
                    Section.totalCountHeading.should('contain.text', String(fullCount));
                });
            });
        });

        it(`REGR-FILTER-${slug}-004: "Наличие в магазине" — список опций соответствует API, выбор применяется через properties[subdivision][]`, () => {
            getCatalogFilters(slug, '').then(({ body: filterBody }) => {
                const group = filterBody.properties.find((p) => p.slug === 'subdivision');
                const store = group.items[0];
                expect(store.count, 'фикстура должна давать >0 результатов').to.be.greaterThan(0);

                Section.visit(slug);
                Section.groupToggle('Наличие в магазине').click();
                Section.openStoreDropdown();
                Section.storeOptions.should('have.length', group.items.length);
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
});

// ---------------------------------------------------------------------------
// Пагинация × фильтры — живая разведка 2026-08-11 (браузер, деплинки, по 5
// попыток на нестабильные кейсы) показала, что это ПОЛНОСТЬЮ непокрытая зона:
// ни один из файлов planshety_filters_*.cy.js/выше не проверял взаимодействие
// пагинации с фильтрами вообще. Найдено и подтверждено:
// - клик по чекбоксу нового фильтра, пока открыта 2-я+ страница, корректно
//   сбрасывает URL `page` на 1 (проверено live: /section/smartfony/
//   ?properties[brend][]=apple&page=2 → клик по цвету → "Показать N" →
//   итоговый URL page=1) — это то, что этот файл теперь защищает регрессом.
// - применённый фильтр переживает переход на след. страницу (чекбокс
//   остаётся checked, URL сохраняет properties[...]+page).
// - deep-link на страницу ВНЕ диапазона для текущего узкого фильтра (напр.
//   ?page=2 при totalCount ≤ 24) в норме отдаёт пустое состояние
//   "Ой, а мы ничего не нашли!", а не карточки — НО один раз из 5 живых
//   попыток именно этого сценария (properties[], не minPrice/maxPrice)
//   страница вместо этого зависла в скелетоне навсегда (0 карточек, лоадер
//   не пропадал 6+ секунд) — похоже на редкую гонку в духе уже известного
//   BUG-034 (см. project_bug034_logout_session_not_terminated), не
//   стабильно воспроизводимую (1/5), поэтому НЕ оформлена как отдельный баг
//   по текущему правилу "функционал сейчас правят" — но сам факт, что
//   правильное поведение (пустое состояние) хотя бы должно быть
//   default/большинство случаев, стоит защитить регрессом ниже; если
//   гонка реальна, этот тест рано или поздно сам поймает её на CI флейком.
// - клик по номеру страницы в самой пагинации НЕ используется в этих
//   тестах: подтверждённое ограничение Cypress в этом проекте (см. skill
//   п.4 "Pagination number buttons don't render in Cypress") — вместо
//   этого переход на страницу делается напрямую через URL (`?page=N`),
//   что эквивалентно с точки зрения проверяемого состояния (URL — источник
//   истины для текущей страницы что при клике, что при deep-link).
//
// Только 2 категории из 4 (planshety — 71 товар, smartfony — 447) имеют
// достаточный объём для реальной 2+ страничной пагинации в текущей
// фикстуре; personalnye-kompyutery (24) и multimediynye-monobloki (18)
// физически укладываются в одну страницу целиком — пагинацию по ним
// проверять не на чем, пока каталог не вырастет.
// Топ-значение первой попавшейся группы, у которой САМОЙ count > 24 (то есть
// применение только её даёт собственную 2-ю страницу). Не завязано на
// конкретную группу ("Бренд"), потому что это НЕ универсально: у planshety
// ни один бренд не набирает больше 19 (см. живую проверку 2026-08-11) — а
// вот "Есть скидка"/"Специальные предложения"/т.п. почти всегда набирают
// больше. Сканирует properties в порядке ответа API — детерминированно для
// одного и того же живого состояния каталога.
function pickGroupWithBigItem(filterBody) {
    for (const group of filterBody.properties) {
        const top = group.items[0];
        if (top && top.count > 24) return { group, item: top };
    }
    return null;
}

const PAGINATED_CATEGORIES = [
    { slug: 'planshety', label: 'Планшеты' },
    { slug: 'smartfony', label: 'Смартфоны' },
];

PAGINATED_CATEGORIES.forEach(({ slug, label }) => {
    describe(`Каталог: фильтры «${label}» (/section/${slug}/) — РЕГРЕСС пагинации × фильтров`, () => {

        it(`REGR-FILTER-PAGE-${slug}-001: применение фильтра, пока открыта 2-я+ страница ПОЛНОГО каталога, сбрасывает URL page на 1`, () => {
            getCatalogFilters(slug, '').then(({ body: filterBody }) => {
                const brandGroup = filterBody.properties.find((p) => p.slug === 'brend');
                const brand = brandGroup.items[0]; // сам фильтр может быть любым — count > 24 здесь не нужен

                getCatalogProducts(slug, '', { properties: { brend: [brand.slug] } }).then(({ body: filteredBody }) => {
                    const expectedCount = filteredBody.meta.totalCount;

                    Section.visit(slug, '?page=2'); // валидная 2-я страница НЕфильтрованного каталога (оба slug'а > 24 товаров суммарно)
                    Section.clickFilterValueCheckbox(brandGroup.name, brand.value);
                    Section.interceptCatalogProducts();
                    Section.clickApplyFiltersWithCount();
                    Section.waitCatalogProducts({ timeout: 20000 }).then((interception) => {
                        expect(interception.response.body.meta.totalCount).to.eq(expectedCount);
                        cy.url().then((url) => {
                            expect(new URL(url).searchParams.get('page'), 'после применения фильтра со 2-й+ страницы URL должен вернуться на 1-ю').to.eq('1');
                        });
                    });
                });
            });
        });

        it(`REGR-FILTER-PAGE-${slug}-002: применённый фильтр остаётся применённым при прямом переходе на следующую страницу (чекбокс + товары 2-й страницы соответствуют API)`, () => {
            getCatalogFilters(slug, '').then(({ body: filterBody }) => {
                const picked = pickGroupWithBigItem(filterBody);
                expect(picked, 'нужна хотя бы одна группа с count > 24 у топ-значения для существования 2-й страницы').to.exist;
                const { group, item } = picked;

                getCatalogProducts(slug, '', { properties: { [group.slug]: [item.slug] }, page: 2 }).then(({ body: page2Body }) => {
                    Section.visit(slug, `?properties[${group.slug}][]=${item.slug}&page=2`);

                    Section.assertFilterValueChecked(group.name, item.value);
                    Section.assertRenderedProductCount(page2Body.products.length);
                    cy.get(`a[href="/product/${page2Body.products[0].slug}/"]`).should('exist');
                });
            });
        });

        it(`REGR-FILTER-PAGE-${slug}-003: запрошенная через URL страница вне диапазона для текущего фильтра — пустое состояние, а не бесконечная загрузка`, () => {
            getCatalogFilters(slug, '').then(({ body: filterBody }) => {
                const brandGroup = filterBody.properties.find((p) => p.slug === 'brend');
                // берём "хвостовой" бренд — маленький, но ненулевой count (ровно 1
                // страница), чтобы page=(следующая) гарантированно была вне диапазона
                const smallBrand = [...brandGroup.items].reverse().find((i) => i.count > 0 && i.count <= 24);
                expect(smallBrand, 'нужен бренд с count в диапазоне (0; 24] для этого сценария').to.exist;
                const outOfRangePage = Math.ceil(smallBrand.count / 24) + 1;

                Section.visit(slug, `?properties[${brandGroup.slug}][]=${smallBrand.slug}&page=${outOfRangePage}`);

                // счётчик в шапке — это totalCount самого фильтра, не зависит от page
                Section.totalCountHeading.should('contain.text', String(smallBrand.count));
                // а сетка товаров — явное пустое состояние, не карточки и не вечный скелетон
                cy.contains(/ничего не нашли/i, { timeout: 15000 }).should('be.visible');
                Section.getRenderedProductSlugs().should('have.length', 0);
            });
        });
    });
});
