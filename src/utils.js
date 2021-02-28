import {vec3} from "gl-matrix";

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

const v0v1Cache = vec3.create(), v0v2Cache = vec3.create(), crossCache = vec3.create()
export function calcAreaOfTriangle(v0, v1, v2) {
  let v0v1 = vec3.subtract(v0v1Cache, v1, v0)
  let v0v2 = vec3.subtract(v0v2Cache, v2, v0)
  let N = vec3.cross(crossCache, v0v1, v0v2)
  return vec3.length(N) * 0.5
}
