import {
  createBufferInfoFromArrays,
  createProgramInfo,
  createVAOFromBufferInfo,
  setBuffersAndAttributes,
  setUniforms
} from './webgl-utils'
import {targetTextureHeight, targetTextureWidth} from './constants'
import {mat4, quat} from 'gl-matrix'
import {flatMap, sumBy, take} from 'lodash'
import {DistantLight} from './distant-light'
import {PointLight} from './point-light'
import {buildShader, SHADER_IMPLEMENT_STRATEGY} from './shader-impl'


export default class ShadowMapRenderer {
  shadowMapConf = null;

  initShadowMapShader(scene, gl) {
    let numDistantLightCount = scene.lights.filter(l => l instanceof DistantLight).length;
    let numPointLightCount = scene.lights.filter(l => l instanceof PointLight).length;
    const numShadowMapTextureCount = numDistantLightCount + numPointLightCount * 6;
    const shaderSources = buildShader(SHADER_IMPLEMENT_STRATEGY.shadowMap);
    let programInfo = createProgramInfo(gl, shaderSources);

    let bufferInfos = scene.meshes.map(mesh => {
      let {vertices, faces} = mesh.geometry;
      // 三角形坐标，不变化的话可以不重新写入数据到缓冲
      let arrays = {
        position: {
          numComponents: 3,
          data: flatMap(vertices, vg => [...vg])
        },
        indices:  {
          numComponents: 3,
          data: flatMap(faces, (f, fIdx) => {
            return f.triangleIndices
          })
        },
      };

      return createBufferInfoFromArrays(gl, arrays);
    });

    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

    // 创建 textureArray 材质
    let texture2dArr = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture2dArr);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    // gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_BASE_LEVEL, 0);
    // gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, 0);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage3D(
      gl.TEXTURE_2D_ARRAY,
      0,
      gl.RGBA,
      targetTextureWidth,
      targetTextureHeight,
      numShadowMapTextureCount, // test with +1, spector's bug?
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    // render to j th layer
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, texture2dArr, 0, 0);

    this.shadowMapConf = {
      programInfo,
      bufferInfos,
      vaos: bufferInfos.map(bi => createVAOFromBufferInfo(gl, programInfo, bi)),
      frameBuffer,
      numShadowMapTextureCount,
      texture2dArr
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
      numShadowMapTextureCount,
      texture2dArr
    } = this.shadowMapConf;
    if (numShadowMapTextureCount === 0) {
      return
    }

    // 计算 world to light space 矩阵
    // 计算投影矩阵
    // 绘制 shadowMap
    let {meshes, lights} = scene;

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
      let {rotation, position, scale} = mesh;
      let qRot = quat.fromEuler(quat.create(), ...rotation)
      let mTransform = mat4.fromRotationTranslationScale(mat4.create(), qRot, position, scale);

      const uMat4ProjW2lTransforms = flatMap(lights, l => {
        if (l instanceof DistantLight) {
          return mat4.multiply(mat4.create(), l.mat4_proj_w2l, mTransform)
        } else {
          return l.mat4_proj_w2l_arr.map(mat4_proj_w2l => {
            return mat4.multiply(mat4.create(), mat4_proj_w2l, mTransform)
          })
        }
      });

      // TODO fix can not use vao bug
      let bufferInfo = shadowMapBufferInfos[i];
      setBuffersAndAttributes(gl, shadowMapProgramInfo.attribSetters, bufferInfo);
      // gl.bindVertexArray(shadowMapVaos[i]);

      for (let j = 0; j < numShadowMapTextureCount; j++) {
        let uniforms = {
          u_mat4_proj_w2l_transform: uMat4ProjW2lTransforms[j]
        };
        setUniforms(shadowMapProgramInfo.uniformSetters, uniforms);

        // render to j th layer
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, texture2dArr, 0, j); // test with +1, spector's bug?

        gl.drawElements(gl.TRIANGLES, shadowMapBufferInfos[i].numElements, gl.UNSIGNED_SHORT, 0);
      }
    }

    return this.shadowMapConf
  }
}
