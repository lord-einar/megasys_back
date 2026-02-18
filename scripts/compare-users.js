import fs from 'fs';

const localContent = fs.readFileSync('local_users_list.txt', 'utf-8');
const prodContent = fs.readFileSync('prod_users_list.txt', 'utf-8');

function parseUsers(content) {
    const lines = content.split('\n');
    const users = new Set();
    let capturing = false;
    for (const line of lines) {
        if (line.trim() === '--- END USERS ---') break;
        if (capturing && line.trim()) users.add(line.trim().toLowerCase());
        if (line.trim() === '--- START USERS ---') capturing = true;
    }
    return users;
}

const localUsers = parseUsers(localContent);
const prodUsers = parseUsers(prodContent);

console.log(`Local Users: ${localUsers.size}`);
console.log(`Prod Users: ${prodUsers.size}`);

const onlyInLocal = [];
for (const user of localUsers) {
    if (!prodUsers.has(user)) {
        onlyInLocal.push(user);
    }
}

console.log('\n--- USUARIOS SOLO EN LOCAL ---');
onlyInLocal.sort().forEach(u => console.log(u));
console.log(`\nTotal solo en local: ${onlyInLocal.length}`);
