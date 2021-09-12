import {fromStackGlPrimitive, Geometry, Material, Mesh, Scene} from './engine'
import {vec3} from 'gl-matrix'
import {RayTracingCamera} from './ray-tracing-camera'
import {SHADER_IMPLEMENT_STRATEGY} from './shader-impl'
import floorObjUrl from './assets/veach_mi/floor.obj'
import plate1ObjUrl from './assets/veach_mi/plate1.obj'
import plate2ObjUrl from './assets/veach_mi/plate2.obj'
import plate3ObjUrl from './assets/veach_mi/plate3.obj'
import plate4ObjUrl from './assets/veach_mi/plate4.obj'
import {loadText, mapAwaitAll} from "./utils";
import sphere from "primitive-sphere";


export default async function genScene() {
  let [floorGeometry, plate1Geometry, plate2Geometry, plate3Geometry, plate4Geometry] = await mapAwaitAll(
    [floorObjUrl, plate1ObjUrl, plate2ObjUrl, plate3ObjUrl, plate4ObjUrl], async url => {
      let objContent = await loadText(url)
      return Geometry.parseObj(objContent)
    })

  let white = new Material({
    color: {r: 0.4, g: 0.4, b: 0.4},
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
  })
  let mirror005 = new Material({
    color: {r: 0.07, g: 0.09, b: 0.13},
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.pbr,
    roughness: 0.005,
    metallic: 0.0
  });
  let mirror02 = new Material({
    color: {r: 0.07, g: 0.09, b: 0.13},
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.pbr,
    roughness: 0.02,
    metallic: 0.0
  });
  let mirror05 = new Material({
    color: {r: 0.07, g: 0.09, b: 0.13},
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.pbr,
    roughness: 0.05,
    metallic: 0.0
  });
  let mirror1 = new Material({
    color: {r: 0.07, g: 0.09, b: 0.13},
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.pbr,
    roughness: 0.1,
    metallic: 0.0
  });

  const light800 = new Material({
    color: {r: 0, g: 0, b: 0},
    selfLuminous: vec3.fromValues(800, 800, 800),
    kS: 0.35,
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
  });
  const light100 = new Material({
    color: {r: 0, g: 0, b: 0},
    selfLuminous: vec3.fromValues(100, 100, 100),
    kS: 0.35,
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
  });
  const light902 = new Material({
    color: {r: 0, g: 0, b: 0},
    selfLuminous: vec3.fromValues(901.803, 901.803, 901.803),
    kS: 0.35,
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
  });
  const light11 = new Material({
    color: {r: 0, g: 0, b: 0},
    selfLuminous: vec3.fromValues(11.1111, 11.1111, 11.1111),
    kS: 0.35,
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
  });
  const light1 = new Material({
    color: {r: 0, g: 0, b: 0},
    selfLuminous: vec3.fromValues(1.23457, 1.23457, 1.23457),
    kS: 0.35,
    shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
  });

  const simplifySphereGeometry = fromStackGlPrimitive(sphere(1, {segments: 4}))

  let meshes = [
    new Mesh({
      name: 'floor',
      geometry: floorGeometry,
      material: white
    }),
    new Mesh({
      name: 'light800',
      geometry: simplifySphereGeometry,
      material: light800,
      position: vec3.fromValues(10, 10, 4),
      scale: vec3.fromValues(0.5, 0.5, 0.5)
    }),
    new Mesh({
      name: 'light902',
      geometry: simplifySphereGeometry,
      material: light902,
      position: vec3.fromValues(-3.75, 0, 0),
      scale: vec3.fromValues(0.03333, 0.03333, 0.03333)
    }),
    new Mesh({
      name: 'light100',
      geometry: simplifySphereGeometry,
      material: light100,
      position: vec3.fromValues(-1.25, 0, 0),
      scale: vec3.fromValues(0.1, 0.1, 0.1)
    }),
    new Mesh({
      name: 'light11',
      geometry: simplifySphereGeometry,
      material: light11,
      position: vec3.fromValues(1.25, 0, 0),
      scale: vec3.fromValues(0.3, 0.3, 0.3)
    }),
    new Mesh({
      name: 'light1',
      geometry: simplifySphereGeometry,
      material: light1,
      position: vec3.fromValues(3.75, 0, 0),
      scale: vec3.fromValues(0.9, 0.9, 0.9)
    }),

    new Mesh({
      name: 'plate1',
      geometry: plate1Geometry,
      material: mirror005
    }),
    new Mesh({
      name: 'plate2',
      geometry: plate2Geometry,
      material: mirror02
    }),
    new Mesh({
      name: 'plate3',
      geometry: plate3Geometry,
      material: mirror05
    }),
    new Mesh({
      name: 'plate4',
      geometry: plate4Geometry,
      material: mirror1
    }),
  ]
  /*let distantLight = new DistantLight(
    mat4.fromXRotation(mat4.create(), (-135* Math.PI) / 180),
    { r: 1, g: 1, b: 1 },
    10
  );*/
  let scene = new Scene(meshes, []);
  await scene.genTexcoordsForMainTexture()

  let camera = new RayTracingCamera();
  camera.position = vec3.fromValues(0, 2, 15);
  camera.target = vec3.fromValues(0, -2, 2.5);
  camera.fov = 28 * Math.PI / 180

  const startAt = Date.now()
  return {
    scene,
    camera,
    onFrame: (ctx) => {
      camera.render(scene, ctx);
    }
  }
}
