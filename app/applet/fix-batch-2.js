const fs = require('fs');
let text = fs.readFileSync('public/ai_batch.json', 'utf8');

text = text.replace(/!\[Image\]\(https:\/\/placehold\.co\/800x400\/e2e8f0\/1e293b\.png\?text=Clinical\+Photograph:\+?([^\"\,]*)\",\n([^\]]*?)\"modelAnswer\":/g, (match, urlText, corruptedMiddle) => {
    let fixedMiddle = corruptedMiddle.replace(/%20/g, ' ');
    return `![Image](https://placehold.co/800x400/e2e8f0/1e293b.png?text=Clinical+Photograph:${urlText})",\n${fixedMiddle}"modelAnswer":`;
});

text = text.replace(/!\[Image\]\(https:\/\/placehold\.co\/800x400\/e2e8f0\/1e293b\.png\?text=Clinical\+Photograph:\+Image\+Hidden\+for\+Safety\",\n([^\]]*?)\"modelAnswer\":/g, (match, corruptedMiddle) => {
    let fixedMiddle = corruptedMiddle.replace(/%20/g, ' ');
    return `![Image](https://placehold.co/800x400/e2e8f0/1e293b.png?text=Clinical+Photograph:+Image+Hidden+for+Safety)",\n${fixedMiddle}"modelAnswer":`;
});

let remaining = text.match(/%20/g);
console.log('remaining %20:', remaining ? remaining.length : 0);
fs.writeFileSync('public/ai_batch.json', text);
