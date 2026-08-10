#!/usr/bin/env node
// Добавляет к summary уже существующих Jira-тикетов префикс страницы, к
// которой относится баг — например: "[Избранное] Поправить UI избранного".
//
// Соответствие ключ Jira -> область читается из scripts/jira-title-areas.json
// (плоский объект { "AS-4503": "Личный кабинет", ... }).
//
// Использование:
//   node scripts/jira-prefix-bug-titles.mjs                — dry-run, ничего
//                                                    не отправляет, только
//                                                    показывает, что изменится
//   node scripts/jira-prefix-bug-titles.mjs --apply         — реально обновляет
//                                                    summary тикетов в Jira
//   node scripts/jira-prefix-bug-titles.mjs --apply --only AS-4503,AS-4504
//                                                            — ограничить набор
//
// Идемпотентно: если текущий summary уже начинается с "[Область] " (совпадает
// с областью из конфига), тикет пропускается.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const onlyArgIndex = args.indexOf('--only');
const onlyKeys = onlyArgIndex >= 0 ? args[onlyArgIndex + 1].split(',').map((s) => s.trim().toUpperCase()) : null;

const envPath = join(repoRoot, '.env.local');
if (!existsSync(envPath)) {
    console.error(`Не найден ${relative(repoRoot, envPath)}. Скопируй .env.local.example -> .env.local и заполни значения.`);
    process.exit(1);
}
process.loadEnvFile(envPath);

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
for (const [name, val] of Object.entries({ JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN })) {
    if (!val) {
        console.error(`Не заполнено ${name} в .env.local`);
        process.exit(1);
    }
}

const areasPath = join(__dirname, 'jira-title-areas.json');
if (!existsSync(areasPath)) {
    console.error(`Не найден ${relative(repoRoot, areasPath)}.`);
    process.exit(1);
}
const areas = JSON.parse(readFileSync(areasPath, 'utf8'));

let entries = Object.entries(areas);
if (onlyKeys) {
    entries = entries.filter(([key]) => onlyKeys.includes(key));
    const missing = onlyKeys.filter((k) => !areas[k]);
    if (missing.length) {
        console.error(`Нет области для ключей: ${missing.join(', ')} — проверь scripts/jira-title-areas.json`);
        process.exit(1);
    }
}

if (entries.length === 0) {
    console.log('Нечего обновлять.');
    process.exit(0);
}

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
};

async function getSummary(key) {
    const res = await fetch(`https://${JIRA_BASE_URL}/rest/api/3/issue/${key}?fields=summary`, { headers });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`GET ${key} -> ${res.status}: ${body}`);
    }
    const data = await res.json();
    return data.fields.summary;
}

async function updateSummary(key, summary) {
    const res = await fetch(`https://${JIRA_BASE_URL}/rest/api/3/issue/${key}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ fields: { summary } }),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`PUT ${key} -> ${res.status}: ${body}`);
    }
}

let changed = 0;
let skipped = 0;
let failed = 0;

for (const [key, area] of entries) {
    const prefix = `[${area}] `;
    try {
        const current = await getSummary(key);
        if (current.startsWith(prefix)) {
            console.log(`= ${key}: уже с префиксом «${area}», пропускаю`);
            skipped++;
            continue;
        }
        const next = `${prefix}${current}`;
        if (!apply) {
            console.log(`[dry-run] ${key}: "${current}" -> "${next}"`);
            changed++;
            continue;
        }
        await updateSummary(key, next);
        console.log(`✓ ${key}: "${current}" -> "${next}"`);
        changed++;
    } catch (err) {
        console.error(`✗ ${key}: ${err.message}`);
        failed++;
    }
}

console.log(`\nИтого: изменено/будет изменено ${changed}, пропущено ${skipped}, ошибок ${failed}.`);
if (!apply) {
    console.log('Это был dry-run — ничего не отправлено в Jira. Запусти с --apply, когда будешь готов.');
}
