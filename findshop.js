const fs = require('fs');
const path = require('path');
function walk(dir){ 
  const entries = fs.readdirSync(dir,{withFileTypes:true}); 
  for(const e of entries){ 
    if(e.isDirectory()){ 
      if(e.name === 'node_modules') continue; 
      walk(path.join(dir,e.name)); 
    } else if(e.name.endsWith('.js') || e.name.endsWith('.ejs')){ 
      const p = path.join(dir,e.name); 
      const c = fs.readFileSync(p,'utf8'); 
      if(c.includes('renderShop')) console.log(p); 
    } 
  } 
} 
walk('C:/Users/Dharsek/OneDrive/Desktop/ecommerce');
