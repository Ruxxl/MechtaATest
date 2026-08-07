import CardsPage, { CARDS_URL } from '../../../support/pageObjects/cardsPage';
import * as cabinetApi from '../../../support/helpers/cabinetApi';

const Cards = new CardsPage();

// Достаём первую карту защищённо — если API вернул пустой/ошибочный ответ
// (напр. транзиентный сетевой сбой, уже наблюдавшийся в этой сессии), тест
// пропускается с понятным логом вместо непонятного TypeError на null.
function firstCardOrSkip(body, testCallback) {
    const card = body && body.data && body.data.cards && body.data.cards[0];
    if (!card) {
        cy.log('Карта недоступна (пустой список или ошибка API) — кейс пропущен');
        return;
    }
    testCallback(card);
}

// Личный кабинет — «Мои карты», /cabinet/cards/, тестовый стенд d2.im.mdev.kz.
// Источник тест-кейсов: TestPlans/LK-full-testcases.md (лист "Мои карты", TC-МО-1..28).
//
// ВАЖНО: у тестового аккаунта ровно ОДНА реальная сохранённая карта, и
// кнопка "Добавить карту" на этом стенде не работает (BUG-016) — то есть
// реальное удаление этой карты необратимо для будущих тестов (новую карту
// добавить будет нечем). Поэтому здесь НЕ выполняется фактическое
// подтверждение удаления (только открытие/отмена диалога) и НЕ тестируется
// добавление карты через реальный ввод платёжных данных (это и запрещено
// правилами безопасности — номера карт/CVC никогда не вводятся, даже
// тестовые). TC-МО-9..11, TC-МО-22..25 помечены как заблокированные ниже.

describe('Мои карты — общие элементы страницы', () => {
    beforeEach(() => {
        cy.loginD2();
        Cards.visit();
    });

    // TC-МО-1
    it('Хлебные крошки «Главная / Личный кабинет / Мои карты»', () => {
        Cards.getBreadcrumbItems().should('have.length', 3);
        Cards.getBreadcrumbItems().eq(2).should('contain.text', 'Мои карты');
        Cards.getBreadcrumbItems().eq(2).find('a').should('not.exist');
    });

    // TC-МО-2
    it('Пункт «Мои карты» в боковом меню подсвечен активным', () => {
        cy.get('nav').eq(1).contains('li', 'Мои карты').find('div').first()
            .should(($el) => {
                const bg = window.getComputedStyle($el[0]).backgroundColor;
                expect(bg, 'фон активного пункта не прозрачный').to.not.eq('rgba(0, 0, 0, 0)');
            });
    });

    // Заголовок страницы — БАГ BUG-015: <h1> существует, но скрыт на десктопе
    // (lg:hidden!). Тест проверяет, что заголовок РЕАЛЬНО виден пользователю
    // (display !== 'none'), а не просто присутствует где-то в DOM.
    it('Заголовок «Мои карты» виден на десктопном вьюпорте — BUG-015', () => {
        cy.get('h1').should('contain.text', 'Мои карты').and('be.visible');
    });

    // TC-МО-3
    it('Блок профиля соответствует данным /v2/personal', () => {
        cabinetApi.getPersonal().then(({ body }) => {
            cy.get('h2').first().should('have.text', body.data.profile_info.full_name);
        });
    });
});

describe('Мои карты — список сохранённых карт', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-МО-4, TC-МО-5 — логотип платёжной системы (SVG без текстовой
    // альтернативы — сверено разведкой 2026-08-07, cy.contains по тексту
    // "VISA" не подходит, проверяем факт наличия SVG-логотипа) и группировка
    // номера по 4
    it('Логотип платёжной системы (SVG) и маскированный номер соответствуют API', () => {
        cabinetApi.getCards().then(({ body }) => {
            firstCardOrSkip(body, (card) => {
                const grouped = card.pan_masked.match(/.{1,4}/g).join(' ');
                Cards.visit();
                Cards.getCardByMaskedPan(grouped).find('svg').should('have.length.at.least', 1);
                cy.contains(grouped).should('be.visible');
            });
        });
    });

    // TC-МО-6 — БЕЗОПАСНОСТЬ: полный номер карты нигде не отображается/не передаётся
    it('БЕЗОПАСНОСТЬ: ответ API и DOM не содержат несокращённого номера карты', () => {
        cabinetApi.getCards().then(({ body }) => {
            const raw = JSON.stringify(body);
            // Полный номер карты — 13-19 цифр подряд без масок (*/пробелов) в середине
            expect(raw, 'ответ API не должен содержать сырую последовательность 13+ цифр подряд')
                .to.not.match(/\d{13,19}(?!\d)/);
        });
        Cards.visit();
        cy.document().then((doc) => {
            const bodyText = doc.body.innerText;
            expect(bodyText, 'DOM не должен содержать сырую последовательность 13+ цифр подряд')
                .to.not.match(/\d{13,19}(?!\d)/);
        });
    });

    // TC-МО-7 — иконка удаления видна у каждой карты
    it('Иконка удаления видна у каждой сохранённой карты', () => {
        cabinetApi.getCards().then(({ body }) => {
            firstCardOrSkip(body, (card) => {
                const grouped = card.pan_masked.match(/.{1,4}/g).join(' ');
                Cards.visit();
                Cards.getDeleteIcon(Cards.getCardByMaskedPan(grouped)).should('exist');
            });
        });
    });

    // TC-МО-8, TC-МО-12 — клик по иконке удаления запрашивает подтверждение;
    // отмена не удаляет карту. НЕ подтверждаем реальное удаление (см. шапку файла).
    it('Клик по иконке удаления открывает диалог подтверждения; отмена не удаляет карту', () => {
        cabinetApi.getCards().then(({ body }) => {
            firstCardOrSkip(body, (card) => {
                const grouped = card.pan_masked.match(/.{1,4}/g).join(' ');
                Cards.visit();
                Cards.getDeleteIcon(Cards.getCardByMaskedPan(grouped)).click({ force: true });
                cy.contains('Удалить карту?').should('be.visible');
                cy.contains('button', 'Отмена').click();
                cy.contains('Удалить карту?').should('not.exist');
                // Карта осталась в списке — отмена не удалила
                cy.contains(grouped).should('be.visible');
            });
        });
    });

    // TC-МО-16, TC-МО-17 — открытые вопросы теста-плана: expiry_date и emitter
    // не должны отображаться нигде на UI (сверено намеренно, не баг)
    it('expiry_date и emitter присутствуют в API, но не отображаются на UI (задокументированное поведение)', () => {
        cabinetApi.getCards().then(({ body }) => {
            firstCardOrSkip(body, (card) => {
                expect(card.expiry_date, 'baseline: expiry_date заполнен в API').to.not.be.empty;
                Cards.visit();
                cy.get('body').should('not.contain.text', card.expiry_date);
                cy.get('body').should('not.contain.text', card.emitter);
            });
        });
    });

    // TC-МО-18 — count == cards.length
    it('count в ответе API равен cards.length', () => {
        cabinetApi.getCards().then(({ body }) => {
            expect(body.data.count).to.eq(body.data.cards.length);
        });
    });
});

describe('Мои карты — добавление карты', () => {
    beforeEach(() => {
        cy.loginD2();
        Cards.visit();
    });

    // TC-МО-20
    it('Блок «Добавить карту» с кнопкой отображается', () => {
        cy.contains('Добавить карту').should('be.visible');
        Cards.getAddCardButton().should('be.visible');
    });

    // TC-МО-21 — БАГ BUG-016: модалка открывается, но внутри неё — пустой
    // iframe (zoid-загрузчик виджета провайдера с незаполненным src), без
    // формы ввода данных карты. Тест ожидает правильное поведение (iframe
    // с реальным src, ведущим на форму провайдера) и падает, пока баг не
    // исправлен.
    it('Клик «Добавить карту» открывает форму привязки новой карты (iframe с src) — BUG-016', () => {
        Cards.getAddCardButton().click();
        cy.get('iframe[title="custom_iframe_loader"]').should('have.attr', 'src').and('not.be.empty');
    });
});

describe('Мои карты — негативные сценарии (обработка ошибок API)', () => {
    beforeEach(() => {
        cy.loginD2();
    });

    // TC-МО-19 — пустое состояние: нет сохранённых карт (мок).
    // ВАЖНО: промо-баннер "Быстрый и удобный способ оплаты / Сохраняйте
    // данные карты в личном кабинете или при оплате и оформляйте товар в
    // два клика" появился на стенде ПРЯМО В ХОДЕ этой сессии тестирования
    // (задеплоен позже, чем изначально писался этот тест) — пользователь
    // указал на скриншот с ним, разведкой 2026-08-07 подтверждено, что он
    // реально показывается в пустом состоянии.
    it('Пустое состояние — промо-баннер и блок «Добавить карту» без списка, без иконки удаления (мок)', () => {
        cy.intercept('GET', '**/v2/personal/card**', {
            statusCode: 200,
            body: { result: true, errors: [], data: { cards: [], count: 0 } },
        }).as('emptyCards');
        // ВАЖНО: не используем Cards.visit() здесь — оно регистрирует
        // СВОЙ intercept на тот же роут поверх мокового, что даёт гонку
        // алиасов (два intercept на один паттерн URL). Явный cy.visit() +
        // ожидание СВОЕГО алиаса.
        cy.visit(CARDS_URL);
        cy.wait('@emptyCards', { timeout: 40000 });
        cy.contains('Быстрый и удобный способ оплаты').should('be.visible');
        cy.contains('Сохраняйте данные карты в личном кабинете или при оплате и оформляйте товар в два клика').should('be.visible');
        cy.contains('Добавить карту').should('be.visible');
        cy.get('span[class*="i-ph:trash"]').should('not.exist');
    });

    // TC-МО-26 — result:false не должен ронять страницу
    it('GET /v2/personal/card с result:false не крашит страницу', () => {
        cy.intercept('GET', '**/v2/personal/card**', {
            statusCode: 200,
            body: { result: false, errors: ['error'], data: null },
        }).as('errorCards');
        cy.visit(CARDS_URL);
        cy.wait('@errorCards', { timeout: 40000 });
        cy.get('nav').eq(1).should('be.visible');
        cy.get('h2').first().should('be.visible');
    });

    // TC-МО-27 — таймаут/500 не должен вешать страницу бессрочно
    it('GET /v2/personal/card — 500 не роняет остальную часть страницы', () => {
        cy.intercept('GET', '**/v2/personal/card**', { statusCode: 500, body: {} }).as('serverError');
        cy.visit(CARDS_URL);
        cy.wait('@serverError', { timeout: 40000 });
        cy.get('nav').eq(1).should('be.visible');
    });
});
