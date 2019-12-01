
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
