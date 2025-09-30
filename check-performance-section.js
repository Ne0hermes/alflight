import fs from 'fs';

const content = fs.readFileSync('src/features/aircraft/AircraftModule.jsx', 'utf8');
const lines = content.split('\n');

let depth = 0;
let inSection = false;
let startLine = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Start tracking when we hit showPerformances
  if (line.includes('{showPerformances && (')) {
    inSection = true;
    startLine = i + 1;
    console.log(`Starting showPerformances section at line ${startLine}`);
    continue;
  }
  
  if (!inSection) continue;
  
  // Count opening tags
  const openDivs = (line.match(/<div/g) || []).length;
  const closeDivs = (line.match(/<\/div>/g) || []).length;
  
  if (openDivs > 0 || closeDivs > 0) {
    depth += openDivs - closeDivs;
    console.log(`Line ${i + 1}: +${openDivs} -${closeDivs} divs, depth=${depth}`);
  }
  
  // Check if we're at the end of the section
  if (line.includes(')}') && line.trim().startsWith(')}')) {
    console.log(`\nEnding showPerformances section at line ${i + 1}`);
    console.log(`Final depth: ${depth}`);
    console.log(`Missing closing divs: ${depth}`);
    break;
  }
  
  // Safety break
  if (i > startLine + 1000) {
    console.log('Safety break - section too long');
    break;
  }
}