async function test() {
  const query = 'bitemporal hemianopia';
  const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&prop=pageimages&piprop=original&format=json&origin=*`;
  const res = await fetch(wikiSearchUrl);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

test();
