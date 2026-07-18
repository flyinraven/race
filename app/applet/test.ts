const s1 = '![Image](https://upload.wikimedia.org/wikipedia/commons/4/46/Iris_atrophy.jpg))})';
let s = s1;
if (s.includes('))})')) {
    s = s.replace(/\)\)\}\)/g, '');
}
console.log('After strip trailing:', s);

s = s.replace(/\!\[Image\]\((https?:\/\/[^\)]+)\)/g, (match, url) => {
    if (url.includes('upload.wikimedia.org')) {
        return '![Image](https://placehold.co/800x400/e2e8f0/1e293b.png?text=Clinical+Photograph:+Image+Hidden+for+Safety)';
    }
    return match;
});
console.log('Final:', s);
