import fs from 'fs';
const content = fs.readFileSync('src/features/aircraft/AircraftModule.jsx', 'utf8');
const lines = content.split('\n');

let inAircraftForm = false;
let openTags = [];
let formStart = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('const AircraftForm = memo')) {
    inAircraftForm = true;
    formStart = i + 1;
  }
  
  if (!inAircraftForm) continue;
  
  if (i === 4855) {  // Line 4856 is where AircraftForm ends
    console.log(`AircraftForm ends at line ${i + 1}`);
    console.log(`Unclosed tags: ${openTags.length}`);
    if (openTags.length > 0) {
      console.log('First 10 unclosed tags:');
      openTags.slice(0, 10).forEach(tag => {
        console.log(`  ${tag.type} opened at line ${tag.line}`);
      });
    }
    break;
  }
  
  // Check for opening tags
  const divMatches = line.match(/<div/g);
  if (divMatches) {
    divMatches.forEach(() => openTags.push({type: 'div', line: i + 1}));
  }
  
  const formMatches = line.match(/<form/g);
  if (formMatches) {
    formMatches.forEach(() => openTags.push({type: 'form', line: i + 1}));
  }
  
  // Check for closing tags
  const closeDivMatches = line.match(/<\/div>/g);
  if (closeDivMatches) {
    closeDivMatches.forEach(() => {
      let found = false;
      for (let j = openTags.length - 1; j >= 0; j--) {
        if (openTags[j].type === 'div') {
          openTags.splice(j, 1);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log(`Extra closing </div> at line ${i + 1}`);
      }
    });
  }
  
  const closeFormMatches = line.match(/<\/form>/g);
  if (closeFormMatches) {
    closeFormMatches.forEach(() => {
      let found = false;
      for (let j = openTags.length - 1; j >= 0; j--) {
        if (openTags[j].type === 'form') {
          openTags.splice(j, 1);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log(`Extra closing </form> at line ${i + 1}`);
      }
    });
  }
}