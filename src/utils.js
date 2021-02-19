
export function mapAwaitAll(arr, mapper) {
  return Promise.all(arr.map(mapper))
}

export async function loadImage(assetsUrl) {
  let image = new Image();
  image.src = assetsUrl;
  await new Promise(resolve => {
    let callback = () => {
      image.removeEventListener('load', callback)
      resolve()
    }
    image.addEventListener('load', callback);
  })
  return image
}

export async function loadText(assetsUrl) {
  let resp = await fetch(assetsUrl)
  return await resp.text()
}
