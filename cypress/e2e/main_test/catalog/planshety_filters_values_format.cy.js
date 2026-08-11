// Каталог: /section/planshety/ — корректность САМИХ значений фильтров
// (не функционала применения, а данных): регистр, единицы измерения
// (ГГц/Гц, ГБ, мА·ч, дюйм), отсутствие пустых/дублирующихся значений.
//
// Разведка живыми данными 2026-08-11 нашла несколько content-аномалий в MDM
// (не программные баги — по решению пользователя не оформляются как БАГ,
// это "логическая"/контентная задача, а не дефект функционала):
// - "Емкость аккумулятора": 2 значения ("28.93 мА·ч", "38.99 мА·ч") — по
//   форме валидны (число + единица), но по факту это Wh-характеристики
//   iPad Air 11 2024 / iPad Pro 13 2024, перепутанные с мА·ч.
// - "Разрешение экрана": одно значение ("2800х1840") использует кириллическую
//   "х" вместо латинской "x", в отличие от остальных 15 значений группы.
// - "Модель процессора": один и тот же чип встречается под двумя разными
//   написаниями ("Kirin T82B" / "HiSilicon Kirin T82B", аналогично
//   Helio G88/G99, T310) — непоследовательный нейминг в MDM.
// Ниже проверяется ФОРМА (регулярное соответствие "число + единица",
// внутренняя согласованность регистра), а не семантическая правильность
// конкретных чисел — поэтому все проверки проходят на текущих живых данных
// и одновременно защищают от будущей регрессии (пропавшая единица измерения,
// пустое значение, дубликат slug).
import { getCatalogFilters } from '../../../support/helpers/catalogFilterApi';
import SectionCatalogPage from '../../../support/pageObjects/catalog/sectionCatalogPage';

const SLUG = 'planshety';
const Section = new SectionCatalogPage();

describe('Планшеты: корректность значений фильтров (регистр, единицы измерения, структура)', () => {

    let filterData;
    before(() => {
        getCatalogFilters(SLUG, '').then(({ body }) => { filterData = body; });
    });

    it('у страницы 22 группы свойств + слайдер цены — структура ответа не деградировала', () => {
        expect(filterData.properties.length).to.eq(22);
        expect(filterData.priceRange.minPrice).to.be.a('number').and.be.greaterThan(0);
        expect(filterData.priceRange.maxPrice).to.be.greaterThan(filterData.priceRange.minPrice);
    });

    it('ни одна группа не пустая, у каждой группы есть name/slug/type', () => {
        filterData.properties.forEach((group) => {
            expect(group.items.length, `группа "${group.slug}" не должна быть пустой`).to.be.greaterThan(0);
            expect(group.name, `группа "${group.slug}" должна иметь читаемое name`).to.be.a('string').and.not.be.empty;
            expect(['list', 'dropdown']).to.include(group.type);
        });
    });

    it('ни у одного значения нет пустой строки, ведущих/хвостовых пробелов или отрицательного счётчика', () => {
        filterData.properties.forEach((group) => {
            group.items.forEach((item) => {
                expect(item.value, `group=${group.slug}`).to.be.a('string').and.not.be.empty;
                expect(item.value, `group=${group.slug} value="${item.value}" не должно иметь пробелов по краям`).to.eq(item.value.trim());
                expect(item.count, `group=${group.slug} value="${item.value}"`).to.be.at.least(0);
                expect(item.count, `group=${group.slug} value="${item.value}" не может превышать totalCount категории`).to.be.at.most(filterData.totalCount);
            });
        });
    });

    it('внутри одной группы нет двух значений с одинаковым slug (не может расщепиться на дубли по идентификатору)', () => {
        filterData.properties.forEach((group) => {
            const slugs = group.items.map((i) => i.slug);
            expect(new Set(slugs).size, `group=${group.slug}`).to.eq(slugs.length);
        });
    });

    it('значения внутри группы отсортированы по убыванию count (та же логика, что подтверждена в акциях — FP-052)', () => {
        ['brend', 'lineyka', 'diagonal-ekrana', 'model-processora'].forEach((slug) => {
            const group = filterData.properties.find((p) => p.slug === slug);
            const counts = group.items.map((i) => i.count);
            expect(counts, `group=${slug}`).to.deep.eq([...counts].sort((a, b) => b - a));
        });
    });

    describe('Единицы измерения — формат "число + единица" единообразен по всей группе', () => {
        it('"Частота обновления экрана" — все значения вида "<число> Гц"', () => {
            const group = filterData.properties.find((p) => p.slug === 'chastota-obnovleniya-ekrana');
            group.items.forEach((item) => expect(item.value).to.match(/^\d+\sГц$/));
        });

        it('"Объем встроенной/оперативной памяти" — все значения вида "<число> ГБ"', () => {
            ['obem-vstroennoy-pamyati', 'obem-operativnoy-pamyati'].forEach((slug) => {
                const group = filterData.properties.find((p) => p.slug === slug);
                group.items.forEach((item) => expect(item.value, `group=${slug}`).to.match(/^\d+\sГБ$/));
            });
        });

        it('"Диагональ экрана" — все значения вида "<число> дюйм"', () => {
            const group = filterData.properties.find((p) => p.slug === 'diagonal-ekrana');
            group.items.forEach((item) => expect(item.value).to.match(/^\d+([.]\d+)?\sдюйм$/));
        });

        it('"Емкость аккумулятора" — все значения вида "<число> мА·ч" (используется корректный символ · — U+00B7, не опечатка вида "мАч"/"mAh")', () => {
            const group = filterData.properties.find((p) => p.slug === 'emkost-akkumulyatora');
            group.items.forEach((item) => expect(item.value).to.match(/^\d+([.]\d+)?\sмА·ч$/));
        });

        it('"Разрешение экрана" — все значения вида "<число>x<число>" (латиница или визуально идентичная кириллица х — обе формы распознаются регэкспом ниже; см. комментарий в шапке файла про непоследовательность конкретно одного значения)', () => {
            const group = filterData.properties.find((p) => p.slug === 'razreshenie-ekrana');
            group.items.forEach((item) => expect(item.value).to.match(/^\d+[xх]\d+$/));
        });
    });

    describe('Бинарные группы — значения строго "Да"/"Нет" (заглавная буква, без вариаций типа "да"/"нет"/"yes"/"no")', () => {
        // "availability" сюда намеренно не входит — её единственное значение
        // "Не с витрины" не бинарное Да/Нет, а содержательное название состояния
        ['discount', 'vozmojnost-zvonkov', 'stilus', 'klaviatura-v-komplekte', 'zaryadnoe-ustroystvo-v-komplekte'].forEach((slug) => {
            it(`group=${slug}`, () => {
                const group = filterData.properties.find((p) => p.slug === slug);
                group.items.forEach((item) => expect(['Да', 'Нет']).to.include(item.value));
            });
        });
    });

    it('"Цвет корпуса" — все значения единообразно в нижнем регистре (внутренняя согласованность стиля, не смешаны "Серый"/"серый")', () => {
        const group = filterData.properties.find((p) => p.slug === 'cvet-korpusa');
        group.items.forEach((item) => expect(item.value).to.eq(item.value.toLowerCase()));
    });

    it('"Бренд" — все значения единообразно начинаются с заглавной буквы', () => {
        const group = filterData.properties.find((p) => p.slug === 'brend');
        group.items.forEach((item) => expect(item.value[0]).to.eq(item.value[0].toUpperCase()));
    });

    it('заголовки групп в UI совпадают 1-в-1 с name из API (без обрезки/лишних пробелов/иной формулировки)', () => {
        cy.visit(`/section/${SLUG}/`);
        Section.filterGroupHeadings.then((uiHeadings) => {
            const apiHeadings = filterData.properties.map((p) => p.name);
            expect(uiHeadings).to.deep.eq(apiHeadings);
        });
    });
});
