import {Geometry, Material, Mesh, Scene} from './engine'
import {mat4, vec3} from 'gl-matrix'
import {Camera} from './webgl-camera'
import {RayTracingCamera} from './ray-tracing-camera'
import {SHADER_IMPLEMENT_STRATEGY} from './shader-impl'
import floorObjUrl from './assets/cornellbox/floor.obj'
import leftObjUrl from './assets/cornellbox/left.obj'
import lightObjUrl from './assets/cornellbox/light.obj'
import rightObjUrl from './assets/cornellbox/right.obj'
import shortBoxObjUrl from './assets/cornellbox/shortbox.obj'
import tallBoxObjUrl from './assets/cornellbox/tallbox.obj'
import {loadText, mapAwaitAll} from "./utils";
import {DistantLight} from "./distant-light";


export default async function genScene() {
  let [floorGeometry, leftGeometry, lightGeometry, rightGeometry, shortBoxGeometry, tallBoxGeometry] = await mapAwaitAll(
    [floorObjUrl, leftObjUrl, lightObjUrl, rightObjUrl, shortBoxObjUrl, tallBoxObjUrl], async url => {
      let objContent = await loadText(url)
      return Geometry.parseObj(objContent)
    })

  let white = new Material({
    color: {r: 0.725, g: 0.71, b: 0.68},
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
  })
  let green = new Material({
    // 0.14f, 0.45f, 0.091f
    color: {r: 0.14, g: 0.45, b: 0.091},
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
  })
  let red = new Material({
    color: {r: 0.63, g: 0.065, b: 0.05},
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
  })
  const light = new Material({
    color: {r: 0.65, g: 0.65, b: 0.65}, // from games101 assignment7
    selfLuminous: vec3.fromValues(47.8348, 38.5664, 31.0808),
    kS: 0.35,
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
  });

  let meshes = [
    new Mesh({
      name: 'floor',
      geometry: floorGeometry,
      material: white
    }),
    new Mesh({
      name: 'shortBox',
      geometry: shortBoxGeometry,
      material: white
    }),
    new Mesh({
      name: 'tallBox',
      geometry: tallBoxGeometry,
      material: white // TODO ues mirror material
    }),
    new Mesh({
      name: 'left',
      geometry: leftGeometry,
      material: red
    }),
    new Mesh({
      name: 'right',
      geometry: rightGeometry,
      material: green
    }),
    new Mesh({
      name: 'light',
      geometry: lightGeometry,
      material: light
    })
  ]
  let distantLight = new DistantLight(
    mat4.fromXRotation(mat4.create(), (-135* Math.PI) / 180),
    { r: 1, g: 1, b: 1 },
    10
  );
  let scene = new Scene(meshes, [/*distantLight*/]);
  await scene.genTexcoordsForMainTexture()

  let camera = new RayTracingCamera();
  camera.position = vec3.fromValues(278, 273, -800);
  camera.target = vec3.fromValues(278, 273, 0);
  camera.fov = 40 * Math.PI / 180

  const startAt = Date.now()
  return {
    scene,
    camera,
    onFrame: (ctx) => {
      camera.render(scene, ctx);
    }
  }
}
