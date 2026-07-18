import https from 'node:https';

const files = [
  "Cataract_in_human_eye.png",
  "Dendritic corneal ulcer.jpg",
  "Acute Angle Closure-glaucoma.jpg",
  "Papilledema.jpg",
  "Ciliary-flush.jpg",
  "Esotropia.jpg",
  "Basal-cell Carcinoma.jpg",
  "Fundus retinoblastoma.jpg",
  "Fundus - diabetic retinopathy.png"
];

const getUrl = (filename) => {
  return new Promise((resolve) => {
    https.get(`https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json`, {
      headers: {
        'User-Agent': 'CoolBot/1.0 (test@example.com)'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const pages = parsed.query.pages;
          const pageId = Object.keys(pages)[0];
          if (pageId === '-1') {
             resolve(null);
          } else {
             resolve(pages[pageId].imageinfo[0].url);
          }
        } catch(e) { resolve(null); }
      });
    });
  });
};

async function main() {
  const map = {};
  for(const f of files) {
    const url = await getUrl(f);
    map[f] = url;
  }
  console.log(JSON.stringify(map, null, 2));
}
main();
