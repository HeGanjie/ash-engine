import wallImgUrl from './assets/brickwall.jpg'
import wallNormalImgUrl from './assets/brickwall_normal.jpg'
import boxImgUrl from './assets/container2.png'
import boxSpecularUrl from './assets/container2_specular.png'
import {Geometry, Material, Mesh, Scene} from './engine'
import {mat4, vec3} from 'gl-matrix'
import {DistantLight} from './distant-light'
import {PointLight} from './point-light'
import {Camera} from './webgl-camera'
import {loadImage} from './utils'
import {SHADER_IMPLEMENT_STRATEGY} from './shader-impl'

async function genScene() {
  let wallImg = await loadImage(wallImgUrl)
  let wallNormalImg = await loadImage(wallNormalImgUrl)
  let boxImg = await loadImage(boxImgUrl)
  let boxSpecularImg = await loadImage(boxSpecularUrl)

  let cubeMesh = new Mesh({
    name: "Cube",
    geometry: Geometry.BoxGeometry,
    material: new Material({
      // color: { r: 1, g: 1, b: 1 },
      diffuseMap: boxImg,
      specularMap: boxSpecularImg,
      kS: 0.15,
      specularExp: 250,
      shaderImpl: SHADER_IMPLEMENT_STRATEGY.lambert
    })
  });

  let planeMesh = new Mesh({
    name: "Ground",
    geometry: Geometry.PlaneGeometry,
    material: new Material({
      // color: { r: 0.5, g: 0.5, b: 0.5 },
      diffuseMap: wallImg,
      normalMap: wallNormalImg,
      kS: 0.04,
      specularExp: 2,
      shaderImpl: SHADER_IMPLEMENT_STRATEGY.lambert
    })
  });
  planeMesh.position = vec3.fromValues(0, -2, 0);
  planeMesh.scale = vec3.fromValues(10, 1, 10);

  let distantLight = new DistantLight(
    mat4.fromXRotation(mat4.create(), (-90* Math.PI) / 180),
    { r: 1, g: 1, b: 1 },
    10
  );

  let distantLight2 = new DistantLight(
    mat4.fromXRotation(mat4.create(), (-135 * Math.PI) / 180),
    { r: 1, g: 1, b: 1 },
    20
  );
  let pointLight1 = new PointLight(
    mat4.fromTranslation(mat4.create(), [-2, 2, 0]),
    { r: 0.6, g: 0.6, b: 1 },
    1000
  );
  let pointLight2 = new PointLight(
    mat4.fromTranslation(mat4.create(), [2, 2, 0]),
    { r: 1, g: 0.6, b: 0.6 },
    1000
  );
  let scene = new Scene([planeMesh, cubeMesh], [distantLight, pointLight1, pointLight2]);
  await scene.genTexcoordsForMainTexture()

  let camera = new Camera();
  camera.position = vec3.fromValues(0, 2, 3);
  camera.target = vec3.fromValues(0, -1, 0);

  const radToAngle = 180 / Math.PI;
// const rotDistanceLight = mat4.fromXRotation(mat4.create(), -0.05 * Math.PI / 180);
  return {
    scene,
    camera,
    onFrame: (ctx) => {
      camera.render(scene, ctx);
      cubeMesh.rotation[0] += 0.01 * radToAngle;
      cubeMesh.rotation[1] += 0.01 * radToAngle;
      // vec3.transformMat4(distantLight.direction, distantLight.direction, rotDistanceLight);
      // vec3.normalize(distantLight.direction, distantLight.direction)
    }
  }
}

export default genScene