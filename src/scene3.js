import wallAlbedoImgUrl from './assets/pbr-wall/albedo.png'
import wallNormalImgUrl from './assets/pbr-wall/normal.png'
import wallMetallicImgUrl from './assets/pbr-wall/metallic.png'
import wallRoughnessImgUrl from './assets/pbr-wall/roughness.png'
import wallAOImgUrl from './assets/pbr-wall/ao.png'
import {Geometry, makeImage, Mesh, PbrMaterial, Scene} from './engine'
import {mat4, vec3} from 'gl-matrix'
import {PointLight} from './point-light'
import {Camera} from './webgl-camera'
import {loadImage, mapAwaitAll} from './utils'
import _ from 'lodash'
import {DistantLight} from './distant-light'

// https://learnopengl-cn.github.io/07%20PBR/02%20Lighting/
export default async function genScene() {
  let [wallAlbedoImg, wallNormalImg, wallMetallicImg, wallRoughnessImg, wallAOImg] = await mapAwaitAll(
    [wallAlbedoImgUrl, wallNormalImgUrl, wallMetallicImgUrl, wallRoughnessImgUrl, wallAOImgUrl], loadImage)

  let grayMaps = _.range(5).map(idx => {
    let v = idx * 2.5 / 10
    return makeImage({r: v, g: v, b: v, a: 1})
  })

  let spheres = _.range(25).map(idx => {
    let x = idx % 5
    let y = Math.floor(idx / 5)
    return new Mesh({
      name: `Sphere-${x}-${y}`,
      position: vec3.fromValues(x * 3, y * 3, 0),
      geometry: Geometry.SphereGeometry,
      material: new PbrMaterial({
        color: {r: 0.5, g: 0, b: 0, a: 1},
        metallicMap: grayMaps[y],
        roughnessMap: grayMaps[x]
      })
    })
  });

  let planeMesh = new Mesh({
    name: "Ground",
    geometry: Geometry.QuadGeometry.transform(vec3.fromValues(-90, 0, 0)),
    position: vec3.fromValues(6, -2, 5),
    scale: vec3.fromValues(30, 1, 20),
    material: new PbrMaterial({
      albedoMap: wallAlbedoImg,
      normalMap: wallNormalImg,
      metallicMap: wallMetallicImg,
      roughnessMap: wallRoughnessImg,
      ambientOcclusionMap: wallAOImg
    })
  });

  let distantLight = new DistantLight(
    mat4.fromXRotation(mat4.create(), (-0* Math.PI) / 180),
    { r: 1, g: 1, b: 1 },
    10
  );

  let pointLightPositions = [
    vec3.fromValues(-10, 10, 10),
    vec3.fromValues(10, 10, 10),
    vec3.fromValues(-10, -10, 10),
    // vec3.fromValues(10, -10, 10)
  ]
  let pointLights = pointLightPositions.map(pPos => PointLight.create(pPos, {r: 1, g: 1, b: 1}, 10000))

  let scene = new Scene([planeMesh, ...spheres], pointLights);
  await scene.genTexcoordsForMainTexture()

  let camera = new Camera();
  camera.position = vec3.fromValues(6, 6, 10);
  camera.target = vec3.fromValues(6, 6, 0);

  return {
    scene,
    camera,
    onFrame: (ctx) => {
      camera.render(scene, ctx);
    }
  }
}
