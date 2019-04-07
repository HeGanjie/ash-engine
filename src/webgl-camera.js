import {mat4, vec3} from "gl-matrix";
import mainVertShader from './shader/main-shader.vert'
import mainFragShader from './shader/main-shader.frag'
import {camera2World, mat4RotateXYZ, webglPerspectiveProjectionMatrix} from "./math";
import {
  createBufferInfoFromArrays,
  createProgramInfo,
  setBuffersAndAttributes,
  setUniforms
} from "./webgl-utils";
import {flatMap, identity, sumBy, take} from 'lodash'
import {renderShadowMap} from "./constants";

let {PI, tan, floor, ceil, min, max} = Math;

export class Camera {
  width = 400;
  height = 300;
  position = vec3.create();
  target = vec3.create();
  nearClippingPlaneDistance = 0.1;
  farClippingPlaneDistance = 1000;

  constructor(width, height, nearClippingPlaneDistance = 0.1, farClippingPlaneDistance = 1000) {
    this.width = width;
    this.height = height;
    this.nearClippingPlaneDistance = nearClippingPlaneDistance;
    this.farClippingPlaneDistance = farClippingPlaneDistance;
  }

  initShader(scene, gl) {
    let programInfo = createProgramInfo(gl, [mainVertShader, mainFragShader]);

    let bufferInfos = scene.meshes.map(mesh => {
      let {faces, normals, vertices} = mesh;

      // 三角形坐标，不变化的话可以不重新写入数据到缓冲
      let arrays = {
        position: {
          numComponents: 3,
          data: flatMap(faces, f => flatMap(f.data, ({V}) => [...vertices[V]]))
        },
        normal: {
          numComponents: 3,
          data: flatMap(faces, f => flatMap(f.data, ({N}) => [...normals[N]])),
        },
        indices:  {
          numComponents: 3,
          data: flatMap(faces, (f, fIdx) => {
            let offset = sumBy(take(faces, fIdx), f => f.data.length)
            return f.triangleIndices.map(ti => ti + offset)
          })
        },
      };

      return createBufferInfoFromArrays(gl, arrays);
    });

    this.webglConf = {
      programInfo,
      bufferInfos
    };
  }

  render(scene, gl, fov = PI / 2) {
    // TODO implement point light and point light shadow map
    // TODO using struct to store light info
    let shadowMapInfos = scene.lights.map(l => l.renderShadowMap(scene, gl));
    if (renderShadowMap) {
      return
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (!this.webglConf) {
      this.initShader(scene, gl);
    }
    let { programInfo, bufferInfos } = this.webglConf;
    let {targetTexture, op_w2l} = shadowMapInfos[0];
    //webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(programInfo.program);

    // 设置光线方向
    let [distantLight] = scene.lights;
    let shadowLightDir = vec3.create();
    distantLight.getShadowLightDirection(shadowLightDir);
    vec3.normalize(shadowLightDir, shadowLightDir);

    let uniforms = {
      u_reverseLightDirection: shadowLightDir,
      u_texShadowMap: targetTexture
    };
    setUniforms(programInfo.uniformSetters, uniforms);

    let c2w = camera2World(mat4.create(), this.position, this.target); // 4 * 4
    let w2c = mat4.invert(mat4.create(), c2w);
    let ppMatrix = webglPerspectiveProjectionMatrix(fov, this.width / this.height, 1, 20);
    let pp_w2c = mat4.multiply(mat4.create(), ppMatrix, w2c);

    for (let i = 0; i < scene.meshes.length; i++) {
      let mesh = scene.meshes[i];
      let {rotation, position} = mesh;
      let m = mat4.create();
      let mRo = mat4RotateXYZ(m, m, ...rotation);
      let mRotTrans = mat4.translate(mat4.create(), mRo, position);

      let pp_w2c_transform = mat4.multiply(mat4.create(), pp_w2c, mRotTrans);
      let op_w2l_transform = mat4.multiply(mat4.create(), op_w2l, mRotTrans);

      let mNormalTrans = mat4.multiply(mat4.create(), w2c, mRo);

      let uniforms = {
        u_matrix: pp_w2c_transform,
        u_shadowMapMatrix: op_w2l_transform,
        u_normalTransform: mat4.transpose(mNormalTrans, mat4.invert(mNormalTrans, mNormalTrans))
      };
      setUniforms(programInfo.uniformSetters, uniforms);

      let bufferInfo = bufferInfos[i];
      setBuffersAndAttributes(gl, programInfo.attribSetters, bufferInfo);

      gl.drawElements(gl.TRIANGLES, bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
    }
  }
}
