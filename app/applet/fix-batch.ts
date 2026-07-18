import fs from 'fs';

let text = fs.readFileSync('public/ai_batch.json', 'utf8');

while (text.includes('))})')) {
    text = text.replace('))})', '');
}

const imageRegex = /\!\[Image\]\((https?:\/\/[^\)]+)\)/g;
text = text.replace(imageRegex, (match, url) => {
    if (url.includes('upload.wikimedia.org')) {
        return '![Image](https://placehold.co/800x400/e2e8f0/1e293b.png?text=Clinical+Photograph:+Image+Hidden+for+Safety)';
    }
    if (url.includes('placehold.co') && url.includes(' ')) {
        return '![Image](' + url.replace(/ /g, '%20') + ')';
    }
    return match;
});

fs.writeFileSync('public/ai_batch.json', text);
console.log('Fixed public/ai_batch.json');
