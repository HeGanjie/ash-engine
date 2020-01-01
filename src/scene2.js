import {Geometry, Material, Mesh, Scene} from './engine'
import {vec3} from 'gl-matrix'
import {Camera} from './webgl-camera'

async function genScene() {
  let meshes = [
    new Mesh({
      name: 'Ground',
      geometry: Geometry.PlaneGeometry,
      material: new Material({color: {r: 0.5, g: 0.5, b: 0.5}}),
      scale: vec3.fromValues(10, 10, 1)
    }),
    new Mesh({
      name: 'triangle',
      geometry: new Geometry({
        vertices: [
          vec3.fromValues(-0.5, 0, 0),
          vec3.fromValues(0, 0.5, 0),
          vec3.fromValues(0.5, 0, 0),
        ],
        normals: [
          vec3.fromValues(0, 0, 1)
        ],
        faces: [
          { data:  [{V: 0, N: 0}, {V: 1, N: 0}, {V: 2, N: 0}] }
        ]
      }),
      material: new Material({color: {r: 1, g: 1, b: 0.5}, selfLuminous: 100}),
      position: vec3.fromValues(0, 1, 0)
    })
  ]
  let scene = new Scene(meshes, []);
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

export default genScene