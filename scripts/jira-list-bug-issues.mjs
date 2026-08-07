#!/usr/bin/env node
// Показывает задачи типа "Баг" в проекте (по умолчанию AS) — чтобы выбрать,
// к какой из них цеплять новые подзадачи через
// `jira-create-bugs.mjs --parent AS-XXXX`.
//
// В этом проекте баги группируются релизными пачками ("Баг"-задача вроде
// "Дефекты 3.30", а отдельные находки — её подзадачи типа "Подзадача").
// По умолчанию показываются только НЕзавершённые пачки (не "Готово"),
// отсортированные по последнему обновлению — свежие сверху.
//
// Использование:
//   node scripts/jira-list-bug-issues.mjs
//   node scripts/jira-list-bug-issues.mjs --search "3.30"      — фильтр по тексту в названии
//   node scripts/jira-list-bug-issues.mjs --all                — включая уже завершённые ("Готово")
//   node scripts/jira-list-bug-issues.mjs --project AS --type Баг

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
};

const envPath = join(repoRoot, '.env.local');
if (!existsSync(envPath)) {
    console.error(`Не найден ${envPath}. Скопируй .env.local.example -> .env.local и заполни значения (токен впиши сам, руками).`);
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

const project = getArg('project', process.env.JIRA_PROJECT_KEY || 'AS');
const issueType = getArg('type', 'Баг');
const searchText = getArg('search', null);
const includeAll = args.includes('--all');

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
const jqlParts = [`project = "${project}"`, `issuetype = "${issueType}"`];
if (!includeAll) jqlParts.push('statusCategory != Done');
if (searchText) jqlParts.push(`summary ~ "${searchText.replace(/"/g, '\\"')}"`);
const jql = `${jqlParts.join(' AND ')} ORDER BY updated DESC`;

// Старый GET /rest/api/3/search (startAt/total) отключён Atlassian
// (410 Gone) — актуальный эндпоинт /rest/api/3/search/jql пагинируется
// через nextPageToken/isLast, без total.
async function fetchAll() {
    const results = [];
    let pageToken = null;
    const maxResults = 100;
    for (;;) {
        let url = `https://${JIRA_BASE_URL}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,status&maxResults=${maxResults}`;
        if (pageToken) url += `&nextPageToken=${encodeURIComponent(pageToken)}`;
        const res = await fetch(url, {
            headers: {
                Authorization: `Basic ${auth}`,
                Accept: 'application/json',
            },
        });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`Jira API ${res.status}: ${body}`);
        }
        const data = await res.json();
        results.push(...data.issues);
        if (data.isLast || !data.nextPageToken || data.issues.length === 0) break;
        pageToken = data.nextPageToken;
    }
    return results;
}

try {
    const issues = await fetchAll();
    if (issues.length === 0) {
        console.log(`Не нашёл ни одной задачи типа "${issueType}" в проекте ${project}.`);
        process.exit(0);
    }
    console.log(`Задачи типа "${issueType}" в проекте ${project} (${issues.length}):\n`);
    for (const issue of issues) {
        const status = issue.fields.status?.name ?? '?';
        console.log(`${issue.key}  [${status}]  ${issue.fields.summary}`);
    }
    console.log(`\nВыбери ключ и передай его в создание багов:\n  node scripts/jira-create-bugs.mjs --parent <КЛЮЧ> --dir "BugReport/..."`);
} catch (err) {
    console.error(err.message);
    process.exit(1);
}
