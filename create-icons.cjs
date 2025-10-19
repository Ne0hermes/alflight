const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create 192x192 icon
const canvas192 = createCanvas(192, 192);
const ctx192 = canvas192.getContext('2d');

// Blue background
ctx192.fillStyle = '#3b82f6';
ctx192.fillRect(0, 0, 192, 192);

// White text
ctx192.fillStyle = '#ffffff';
ctx192.font = 'bold 80px Arial';
ctx192.textAlign = 'center';
ctx192.textBaseline = 'middle';
ctx192.fillText('SGV', 96, 96);

// Save 192x192
const buffer192 = canvas192.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, 'public', 'icon-192.png'), buffer192);
console.log('✅ Created icon-192.png');

// Create 512x512 icon
const canvas512 = createCanvas(512, 512);
const ctx512 = canvas512.getContext('2d');

// Blue background
ctx512.fillStyle = '#3b82f6';
ctx512.fillRect(0, 0, 512, 512);

// White text
ctx512.fillStyle = '#ffffff';
ctx512.font = 'bold 200px Arial';
ctx512.textAlign = 'center';
ctx512.textBaseline = 'middle';
ctx512.fillText('SGV', 256, 256);

// Save 512x512
const buffer512 = canvas512.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, 'public', 'icon-512.png'), buffer512);
console.log('✅ Created icon-512.png');

console.log('\n🎨 Icons created successfully!');
