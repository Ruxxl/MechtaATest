// Общие утилиты для сравнения текста из UI с данными из API.
// Вынесены сюда, т.к. одна и та же нормализация (цена/пробелы/NBSP)
// раньше дублировалась в product_page.js, add_basket.js и checkout.js.

// "12 345 ₸" -> "12345"
export function normalizePrice(text) {
    return text
        .replace(/\s/g, '') // обычные пробелы и NBSP (\\s матчит NBSP в JS regex)
        .replace('₸', '')
        .trim();
}

// Оставляет только цифры: "Доступно в 3 магазинах" -> "3"
export function digitsOnly(text) {
    return text.replace(/\D/g, '');
}

// Заменяет NBSP на обычный пробел и обрезает края (пробелы внутри строки сохраняются)
export function normalizeWhitespace(text) {
    return text.replace(/ /g, ' ').trim();
}
