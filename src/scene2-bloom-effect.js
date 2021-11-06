import {Geometry, Material, Mesh, Scene} from './engine'
import {vec3} from 'gl-matrix'
import {Camera} from './webgl-rasterization-camera'
import {SHADER_IMPLEMENT_STRATEGY} from './shader-impl'

export default async function genScene() {
  let meshes = [
    new Mesh({
      name: 'Ground',
      geometry: Geometry.QuadGeometry,
      material: new Material({
        color: {r: 0.5, g: 0.5, b: 0.5},
        shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
      }),
      scale: vec3.fromValues(10, 10, 1)
    }),
    new Mesh({
      name: 'triangle',
      geometry: Geometry.TrianglePlaneGeometry,
      material: new Material({
        color: {r: 1, g: 1, b: 0.5},
        // selfLuminous: 100,
        shaderImpl: SHADER_IMPLEMENT_STRATEGY.diffuseMap
      }),
      position: vec3.fromValues(0, 1, 0)
    })
  ]
  let scene = new Scene(meshes, []);
  await scene.genTexcoordsForMainTexture()

  let camera = new Camera();
  camera.position = vec3.fromValues(0, 0, 10);
  camera.target = vec3.fromValues(0, 0, 0);

  const radToAngle = 180 / Math.PI;
  const startAt = Date.now()
  return {
    scene,
    camera,
    onFrame: (ctx) => {
      camera.render(scene, ctx);
      let theta = (Date.now() - startAt) / 1000
      meshes[1].rotation = vec3.fromValues(0, 0, theta % (2 * Math.PI) * radToAngle)
      meshes[1].position = vec3.fromValues(5 * Math.cos(theta), 5 * Math.sin(theta), 0.1)
    }
  }
}
