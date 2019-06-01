import {
  createBufferInfoFromArrays,
  createProgramInfo,
  createVAOFromBufferInfo,
  setBuffersAndAttributes,
  setUniforms
} from "./webgl-utils";
import distantLightVertShader from "./shader/shadow-map.vert";
import distantLightFragShader from "./shader/shadow-map.frag";
import {renderShadowMap, targetTextureHeight, targetTextureWidth} from "./constants";
import {mat4, quat} from "gl-matrix";
import {flatMap, sumBy, take, range, template} from 'lodash'
import {DistantLight} from "./distant-light";
import {PointLight} from "./point-light";


export default class ShadowMapRenderer {
  shadowMapConf = null;

  initShadowMapShader(scene, gl) {
    let numDistantLightCount = scene.lights.filter(l => l instanceof DistantLight).length;
    let numPointLightCount = scene.lights.filter(l => l instanceof PointLight).length;
    const numShadowMapTextureCount = numDistantLightCount + numPointLightCount * 6;
    const shaderSources = [distantLightVertShader, distantLightFragShader];
    let programInfo = createProgramInfo(gl, shaderSources);

    let bufferInfos = scene.meshes.map(mesh => {
      let {vertices, faces} = mesh;
      // 三角形坐标，不变化的话可以不重新写入数据到缓冲
      let arrays = {
        position: {
          numComponents: 3,
          data: flatMap(faces, f => flatMap(f.data, ({V}) => [...vertices[V]]))
        },
      };

      return createBufferInfoFromArrays(gl, arrays);
    });

    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    let offset = 0;
    // TODO use glFramebufferTextureLayer
    scene.lights.forEach((l, idx) => {
      l.initShadowMapTexture(gl, idx);
      if (l instanceof DistantLight) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + offset,
          gl.TEXTURE_2D, l.texture, 0);
        offset += 1;
      } else if (l instanceof PointLight) {
        for (let i = 0; i < 6; i++) {
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + offset,
            gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, l.texture, 0);
          offset += 1;
        }
      }
    });

    this.shadowMapConf = {
      programInfo,
      bufferInfos,
      vaos: bufferInfos.map(bi => createVAOFromBufferInfo(gl, programInfo, bi)),
      frameBuffer,
      numShadowMapTextureCount
    };
  }

  renderShadowMap(scene, gl) {
    if (!this.shadowMapConf) {
      this.initShadowMapShader(scene, gl);
    }
    let {
      programInfo: shadowMapProgramInfo,
      bufferInfos: shadowMapBufferInfos,
      vaos: shadowMapVaos,
      frameBuffer,
      numShadowMapTextureCount
    } = this.shadowMapConf;

    // 计算 world to light space 矩阵
    // 计算投影矩阵
    // 绘制 shadowMap
    let {meshes, lights} = scene;

    // TODO 调试时直接将 color[debugIdx] 写入到 color[0] 即可
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.viewport(0, 0, targetTextureWidth, targetTextureHeight);

    // tell it we want to draw to all n attachments
    // gl.drawBuffers(range(numShadowMapTextureCount).map(i => gl.COLOR_ATTACHMENT0 + i));

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(shadowMapProgramInfo.program);

    lights.forEach(l => l.calcProjectAndWorldToLightMatrix(scene));

    for (let i = 0; i < meshes.length; i++) {
      let mesh = meshes[i];
      let {rotation, position} = mesh;
      let mRotTran = mat4.fromRotationTranslation(mat4.create(), quat.fromEuler(quat.create(), ...rotation), position);

      let uniforms = {
        u_mat4_proj_w2l_transform: flatMap(lights, l => {
          if (l instanceof DistantLight) {
            let m4 = mat4.multiply(mat4.create(), l.mat4_proj_w2l, mRotTran);
            return [...m4]
          } else {
            return flatMap(l.mat4_proj_w2l_arr, mat4_proj_w2l => {
              let m4 = mat4.multiply(mat4.create(), mat4_proj_w2l, mRotTran);
              return [...m4]
            })
          }
        })
      };
      setUniforms(shadowMapProgramInfo.uniformSetters, uniforms);

      // let bufferInfo = shadowMapBufferInfos[i];
      // setBuffersAndAttributes(gl, shadowMapProgramInfo.attribSetters, bufferInfo);
      gl.bindVertexArray(shadowMapVaos[i]);

      gl.drawElements(gl.TRIANGLES, shadowMapBufferInfos[i].numElements, gl.UNSIGNED_SHORT, 0);
    }

    return this.shadowMapConf
  }
}
