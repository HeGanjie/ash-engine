import {mat4, quat, vec3} from "gl-matrix";
import mainVertShader from './shader/main-shader.vert'
import mainFragShader from './shader/main-shader.frag'
import {createBufferInfoFromArrays, createProgramInfo, createVAOFromBufferInfo, setUniforms} from "./webgl-utils";
import {flatMap, sumBy, take} from 'lodash'
import {renderShadowMap} from "./constants";
import {DistantLight} from "./distant-light";
import ShadowMapRenderer from "./shadow-map-renderer";
import {PointLight} from "./point-light";

let {PI, tan, floor, ceil, min, max} = Math;

export class Camera {
  width = 400;
  height = 300;
  position = vec3.create();
  target = vec3.create();
  nearClippingPlaneDistance = 0.1;
  farClippingPlaneDistance = 1000;
  shadowMapRenderer = null;

  constructor(width, height, nearClippingPlaneDistance = 0.1, farClippingPlaneDistance = 1000) {
    this.width = width;
    this.height = height;
    this.nearClippingPlaneDistance = nearClippingPlaneDistance;
    this.farClippingPlaneDistance = farClippingPlaneDistance;
    this.shadowMapRenderer = new ShadowMapRenderer()
  }

  initShader(scene, gl) {
    let numDistantLightCount = scene.lights.filter(l => l instanceof DistantLight).length;
    let numPointLightCount = scene.lights.filter(l => l instanceof PointLight).length;
    const shaderSources = [mainVertShader, mainFragShader]
      .map(src => {
        return src
          .replace(/NUM_DISTANT_LIGHT/g, numDistantLightCount)
          .replace(/NUM_POINT_LIGHT/g, numPointLightCount)
          .replace(/NUM_LIGHTS/g, scene.lights.length)
      });
    let programInfo = createProgramInfo(gl, shaderSources);

    let bufferInfos = scene.meshes.map(mesh => {
      let {faces, normals, vertices, verticesColor} = mesh;

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
        color: {
          numComponents: 3,
          data: flatMap(faces, f => flatMap(f.data, ({V}) => {
            const color = verticesColor[V];
            return [color.r, color.g, color.b]
          })),
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
      bufferInfos,
      vaos: bufferInfos.map(bi => createVAOFromBufferInfo(gl, programInfo, bi))
    };
  }

  render(scene, gl, fov = PI / 2) {
    // TODO implement point light and point light shadow map
    // TODO support multi distant light (render to single texture)
    // let shadowMapInfos = scene.lights.map(l => ({ light: l, ...l.renderShadowMap(scene, gl) }));
    this.shadowMapRenderer.renderShadowMap(scene, gl);
    if (renderShadowMap) {
      return
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (!this.webglConf) {
      this.initShader(scene, gl);
    }
    let { programInfo, bufferInfos, vaos } = this.webglConf;
    //webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(programInfo.program);

    const uniformOfLights = shadowMapInfos
      .filter(info => info.light instanceof DistantLight)
      .reduce((acc, curr, idx) => {
        let {direction, color, intensity} = curr.light;
        acc[`u_distantLights[${idx}].direction`] = direction;
        acc[`u_distantLights[${idx}].color`] = vec3.fromValues(color.r, color.g, color.b);
        acc[`u_distantLights[${idx}].intensity`] = intensity;
        acc[`u_distantLights[${idx}].reverseLightDirection`] = vec3.scale(vec3.create(), direction, -1);
        // acc[`u_distantLights[${idx}].indexOfLights`] = idx;
        return acc
      }, {});
    let uniforms = Object.assign({ u_texShadowMap: shadowMapInfos[0].targetTexture }, uniformOfLights);
    setUniforms(programInfo.uniformSetters, uniforms);

    let w2c = mat4.lookAt(mat4.create(), this.position, this.target, vec3.fromValues(0, 1, 0));
    let ppMatrix = mat4.perspective(mat4.create(), fov, this.width / this.height, 1, 20);
    let pp_w2c = mat4.multiply(mat4.create(), ppMatrix, w2c);

    for (let i = 0; i < scene.meshes.length; i++) {
      let mesh = scene.meshes[i];
      let {rotation, position, albedo} = mesh;
      let mRo = mat4.fromQuat(mat4.create(), quat.fromEuler(quat.create(), ...rotation));
      let mRotTrans = mat4.translate(mat4.create(), mRo, position);

      let pp_w2c_transform = mat4.multiply(mat4.create(), pp_w2c, mRotTrans);

      let m4_w2c_rot = mat4.multiply(mat4.create(), w2c, mRo);

      let uniforms = Object.assign({
          u_albedoDivPI: albedo / Math.PI,
          u_mat4_pp_w2c_transform: pp_w2c_transform,
          u_mat4_w2c_rot_inv_T: mat4.transpose(m4_w2c_rot, mat4.invert(m4_w2c_rot, m4_w2c_rot)),
        }, shadowMapInfos
        .filter(info => info.light instanceof DistantLight)
        .reduce((acc, curr, idx) => {
          acc[`u_distantLights[${idx}].op_w2l_transform`] = mat4.multiply(mat4.create(), curr.op_w2l, mRotTrans);
          return acc
        }, {})
      );
      setUniforms(programInfo.uniformSetters, uniforms);

      let bufferInfo = bufferInfos[i];
      gl.bindVertexArray(vaos[i]);

      gl.drawElements(gl.TRIANGLES, bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
    }
  }
}
