import fs from 'fs';

const content = fs.readFileSync('src/features/aircraft/AircraftModule.jsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
const openingLines = [];

// Manually check lines 2195-3074 (the showPerformances section)
for (let i = 2194; i < 3074; i++) {
  const line = lines[i];
  
  // Count opening and closing divs
  const openDivs = (line.match(/<div/g) || []).length;
  const closeDivs = (line.match(/<\/div>/g) || []).length;
  
  for (let j = 0; j < openDivs; j++) {
    depth++;
    openingLines.push(i + 1);
  }
  
  for (let j = 0; j < closeDivs; j++) {
    depth--;
    if (openingLines.length > 0) {
      openingLines.pop();
    }
  }
}

console.log(`\nshowPerformances section (lines 2195-3074):`);
console.log(`Final depth: ${depth}`);
console.log(`Missing closing divs: ${depth}`);

if (depth > 0) {
  console.log(`\nUnclosed divs opened at lines:`);
  openingLines.forEach(line => console.log(`  Line ${line}`));
}