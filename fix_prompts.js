// Script para corrigir os prompts corrompidos
import fs from 'fs';

let content = fs.readFileSync('api/chat.js', 'utf8');

// Corrigir caracteres corrompidos no prompt do Funk SP
content = content.replace(/- � Copie o primeiro kick/g, '- 🔁 Copie o primeiro kick');
content = content.replace(/- � O resultado é um padrão/g, '- 🎯 O resultado é um padrão');
content = content.replace(/- � Copie o loop/g, '- 🔁 Copie o loop');
content = content.replace(/- � Mixe cada percussão/g, '- 🧽 Mixe cada percussão');
content = content.replace(/- �️ Substitua a capela/g, '- 🗑️ Substitua a capela');

// Corrigir outros caracteres que possam estar corrompidos
content = content.replace(/alÃ©m/g, 'além');

fs.writeFileSync('api/chat.js', content, 'utf8');
console.log('Prompts corrigidos!');
