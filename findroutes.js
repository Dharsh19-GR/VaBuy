const fs = require('fs');
const s = fs.readFileSync('C:/Users/Dharsek/OneDrive/Desktop/ecommerce/routes/store.js','utf8');
const re = /router\.[^\r\n]+(shop|product)[^\r\n]+/g;
let m;
while((m = re.exec(s)) !== null){
  console.log(m[0]);
}
