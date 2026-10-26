const fs = require('fs');
const s = fs.readFileSync('routes/store.js','utf8');
const m = s.match(/router\.get\([^)]+\)/g);
if(m){ m.slice(0,20).forEach(x=>console.log(x)); }
