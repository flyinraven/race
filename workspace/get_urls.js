import https from 'https';
import fs from 'fs';

const files = [
  "Cataract_in_human_eye.png",
  "Herpes_simplex_keratitis.jpg",
  "Glaukom01.jpg",
  "Papilledema_2.jpg",
  "Anterior_uveitis_%28hypopyon%29.jpg",
  "Left_Abducens_Nerve_Palsy_Primary_Gaze.jpg",
  "Basal-cell_carcinoma_of_lower_eyelid.jpg",
  "Leukocoria.jpg",
  "Central_retinal_vein_occlusion.jpg"
];

const getUrl = (filename) => {
  return new Promise((resolve) => {
    https.get(`https://commons.wikimedia.org/w/api.php?action=query&titles=File:${filename}&prop=imageinfo&iiprop=url&format=json`, (res) => {
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
  const result = {};
  for(const f of files) {
    const url = await getUrl(f);
    result[f] = url;
    console.log(f, url);
  }
}
main();
