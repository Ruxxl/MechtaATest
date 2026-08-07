#!/usr/bin/env node
// Создаёт задачи в Jira по нашим BugReport/**/README.md таблицам.
//
// Использование:
//   node scripts/jira-list-bug-issues.mjs                          — сначала
//                                                        посмотреть список
//                                                        задач типа "Баг" и
//                                                        выбрать родителя
//   node scripts/jira-create-bugs.mjs --parent AS-XXXX             — dry-run,
//                                                        ничего не отправляет,
//                                                        просто показывает,
//                                                        что было бы создано
//   node scripts/jira-create-bugs.mjs --parent AS-XXXX --apply     — реально
//                                                        создаёт подзадачи
//                                                        в Jira под AS-XXXX
//   node scripts/jira-create-bugs.mjs --parent AS-XXXX --apply --dir "BugReport/Личный кабинет/orders"
//                                                      — ограничить одной
//                                                        папкой
//   node scripts/jira-create-bugs.mjs --parent AS-XXXX --apply --only BUG-001
//                                                      — создать РОВНО один
//                                                        баг (пробный запуск
//                                                        перед полной пачкой)
//
// --parent обязателен (либо этим флагом, либо через JIRA_PARENT_KEY в
// .env.local) — баги всегда создаются как подзадачи конкретной задачи, не
// сами по себе.
//
// Настройки читаются из .env.local (см. .env.local.example). Уже
// созданные баги не дублируются — маппинг BUG-id -> ключ Jira хранится в
// scripts/jira-mapping.json и коммитится в репозиторий как справочник.

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// --- аргументы командной строки ---
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dirArgIndex = args.indexOf('--dir');
const scanDir = dirArgIndex >= 0 ? join(repoRoot, args[dirArgIndex + 1]) : join(repoRoot, 'BugReport');
const onlyArgIndex = args.indexOf('--only');
const onlyId = onlyArgIndex >= 0 ? args[onlyArgIndex + 1].toUpperCase() : null;
const parentArgIndex = args.indexOf('--parent');
const parentOverride = parentArgIndex >= 0 ? args[parentArgIndex + 1] : null;

// --- .env.local ---
const envPath = join(repoRoot, '.env.local');
if (!existsSync(envPath)) {
    console.error(`Не найден ${relative(repoRoot, envPath)}. Скопируй .env.local.example -> .env.local и заполни значения.`);
    process.exit(1);
}
process.loadEnvFile(envPath);

const {
    JIRA_BASE_URL,
    JIRA_EMAIL,
    JIRA_API_TOKEN,
    JIRA_PROJECT_KEY,
    JIRA_ISSUE_TYPE,
} = process.env;

const JIRA_PARENT_KEY = parentOverride || process.env.JIRA_PARENT_KEY;

for (const [name, val] of Object.entries({ JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY, JIRA_ISSUE_TYPE })) {
    if (!val) {
        console.error(`Не заполнено ${name} в .env.local`);
        process.exit(1);
    }
}

if (!JIRA_PARENT_KEY) {
    console.error(
        'Родительская задача не указана. Баги создаются только как подзадачи.\n' +
        'Сначала посмотри список задач-контейнеров:\n' +
        '  node scripts/jira-list-bug-issues.mjs\n' +
        'а затем передай выбранный ключ:\n' +
        '  node scripts/jira-create-bugs.mjs --parent AS-XXXX ...'
    );
    process.exit(1);
}

// Severity в наших README -> приоритет в Jira. Поправь под свою схему,
// если названия приоритетов в Jira другие.
const SEVERITY_TO_PRIORITY = {
    Critical: 'Highest',
    High: 'High',
    Medium: 'Medium',
    Low: 'Low',
};

// --- маппинг уже созданных багов ---
const mappingPath = join(__dirname, 'jira-mapping.json');
const mapping = existsSync(mappingPath) ? JSON.parse(readFileSync(mappingPath, 'utf8')) : {};

// --- находим все README.md рекурсивно ---
function findReadmes(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            out.push(...findReadmes(full));
        } else if (entry === 'README.md') {
            out.push(full);
        }
    }
    return out;
}

if (!existsSync(scanDir)) {
    console.error(`Директория не найдена: ${relative(repoRoot, scanDir)}`);
    process.exit(1);
}
const readmes = findReadmes(scanDir);

// Строка таблицы вида:
// | [BUG-004](./BUG-004-zero-price-orders-with-real-payment.md) | Название | High | Подтверждён |
// Severity-колонка иногда обёрнута в markdown-жирный и/или несёт суффикс
// вроде "**Critical (P1)**" — вытаскиваем само слово, остальное игнорируем.
const ROW_RE = /^\|\s*\[BUG-(\d+)\]\(\.\/([^)]+)\)\s*\|\s*(.+?)\s*\|\s*\**(Critical|High|Medium|Low)\b[^|]*\|/;

const found = [];
for (const readmePath of readmes) {
    const dir = dirname(readmePath);
    const lines = readFileSync(readmePath, 'utf8').split('\n');
    for (const line of lines) {
        const m = line.match(ROW_RE);
        if (!m) continue;
        const [, num, fileName, title, severity] = m;
        const filePath = join(dir, fileName);
        found.push({
            id: `BUG-${num}`,
            title,
            severity,
            filePath,
            area: relative(scanDir, dir) || '.',
            // ID типа "BUG-001" переиспользуется в РАЗНЫХ папках (нумерация
            // рестартует по разделу — Личный кабинет, Товар/product_page,
            // Акции и т.д.), поэтому ключ маппинга/дедупликации строим из
            // полного пути к файлу, а не голого id — иначе создание бага в
            // одной папке ошибочно "гасит" одноимённый BUG-001 в другой.
            mapKey: relative(repoRoot, filePath),
        });
    }
}

const scoped = onlyId ? found.filter((b) => b.id === onlyId) : found;
if (onlyId && scoped.length > 1) {
    console.error(`--only ${onlyId}: id неоднозначен, совпало ${scoped.length} багов в разных папках (нумерация в каждой папке своя):\n`);
    for (const b of scoped) console.error(`  ${relative(repoRoot, b.filePath)}`);
    console.error('\nДобавь --dir, чтобы указать конкретную папку.');
    process.exit(1);
}
if (onlyId && scoped.length === 0) {
    console.error(`--only ${onlyId}: такой баг не найден в ${relative(repoRoot, scanDir)}`);
    process.exit(1);
}

if (scoped.length === 0) {
    console.log('Ни одной строки с багом не найдено — проверь путь/формат таблиц в README.md.');
    process.exit(0);
}

const toCreate = scoped.filter((b) => !mapping[b.mapKey]);
const alreadyDone = scoped.filter((b) => mapping[b.mapKey]);

console.log(`Найдено багов: ${scoped.length}. Уже в Jira: ${alreadyDone.length}. К созданию: ${toCreate.length}.\n`);

if (toCreate.length === 0) {
    console.log('Всё уже создано, нечего делать.');
    process.exit(0);
}

// --- ADF (Atlassian Document Format) описание из markdown-файла ---
// Минимальная конвертация: каждый непустой абзац -> paragraph. Этого
// достаточно, чтобы текст читался в Jira; сложную markdown-разметку
// (таблицы, картинки) не воспроизводим — ссылка на исходный .md остаётся
// в репозитории как источник правды.
function toADF(markdown, sourceRelPath) {
    const paragraphs = markdown
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    const content = paragraphs.map((p) => ({
        type: 'paragraph',
        content: [{ type: 'text', text: p }],
    }));

    content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `Источник: ${sourceRelPath}` }],
    });

    return { type: 'doc', version: 1, content };
}

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
const apiUrl = `https://${JIRA_BASE_URL}/rest/api/3/issue`;

async function createIssue(bug) {
    const markdown = readFileSync(bug.filePath, 'utf8');
    const sourceRelPath = relative(repoRoot, bug.filePath);

    const fields = {
        project: { key: JIRA_PROJECT_KEY },
        summary: bug.title,
        issuetype: { name: JIRA_ISSUE_TYPE },
        description: toADF(markdown, sourceRelPath),
        priority: { name: SEVERITY_TO_PRIORITY[bug.severity] || 'Medium' },
    };
    if (JIRA_PARENT_KEY) {
        fields.parent = { key: JIRA_PARENT_KEY };
    }

    if (!apply) {
        console.log(`[dry-run] создал бы: ${bug.id} (${bug.severity}) — "${bug.title.slice(0, 70)}${bug.title.length > 70 ? '…' : ''}"`);
        return null;
    }

    const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Jira API ${res.status} для ${bug.id}: ${body}`);
    }

    const data = await res.json();
    return data.key;
}

for (const bug of toCreate) {
    try {
        const key = await createIssue(bug);
        if (key) {
            mapping[bug.mapKey] = { id: bug.id, jiraKey: key, area: bug.area, createdAt: new Date().toISOString() };
            console.log(`✓ ${bug.id} (${bug.mapKey}) -> ${key}`);
        }
    } catch (err) {
        console.error(`✗ ${bug.id}: ${err.message}`);
    }
}

if (apply) {
    writeFileSync(mappingPath, JSON.stringify(mapping, null, 2) + '\n');
    console.log(`\nМаппинг сохранён в ${relative(repoRoot, mappingPath)}`);
} else {
    console.log('\nЭто был dry-run — ничего не отправлено в Jira. Запусти с --apply, когда будешь готов.');
}
