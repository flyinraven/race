const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=glaucoma&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&format=json&origin=*`;
fetch(url).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(err => console.error(err));
