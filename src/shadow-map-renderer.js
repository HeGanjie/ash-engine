import {
  createBufferInfoFromArrays,
  createProgramInfo,
  createVAOFromBufferInfo,
  setBuffersAndAttributes,
  setUniforms
} from "./webgl-utils";
import distantLightVertShader from "./shader/shadow-map.vert";
import distantLightFragShader from "./shader/shadow-map.fs";
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
    const shaderSources = [distantLightVertShader, distantLightFragShader]
      .map(src => {
        const pass1 = template(src)({
          NUM_TEXTURES: numShadowMapTextureCount
        });
        return pass1.replace(/NUM_TEXTURES/g, numShadowMapTextureCount);
      });
    let programInfo = createProgramInfo(gl, shaderSources);

    let bufferInfos = scene.meshes.map(mesh => {
      let {vertices, faces} = mesh;
      // 三角形坐标，不变化的话可以不重新写入数据到缓冲
      const indicesData = flatMap(faces, (f, fIdx) => {
        let offset = sumBy(take(faces, fIdx), f => f.data.length);
        return f.triangleIndices.map(ti => ti + offset)
      });
      let arrays = {
        position: {
          numComponents: 3, // 3 个数构成一个 position
          data: flatMap(faces, f => flatMap(f.data, ({V}) => [...vertices[V]]))
        },
        indices: {
          numComponents: 3, // 3 个点的索引构成一个三角形
          data: flatMap(range(numShadowMapTextureCount), () => indicesData)
        },
        layout: {
          // TODO 调试时直接渲染某层
          numComponents: 1, // 指定这个位置渲染到哪个层
          data: flatMap(range(numShadowMapTextureCount), texIdx => {
            return Array.from({length: indicesData.length}).fill(texIdx);
          }),
          type: Int32Array
        }
      };

      return createBufferInfoFromArrays(gl, arrays);
    });

    if (renderShadowMap) {
      this.shadowMapConf = {
        programInfo,
        bufferInfos,
        vaos: bufferInfos.map(bi => createVAOFromBufferInfo(gl, programInfo, bi))
      };
      return;
    }

    const frameBuffer = renderShadowMap ? null : gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    let offset = 0;
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
      frameBuffer
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
      frameBuffer
    } = this.shadowMapConf;

    // 计算 world to light space 矩阵
    // 计算投影矩阵
    // 绘制 shadowMap
    let {meshes, lights} = scene;

    // TODO 调试时直接将 color[debugIdx] 写入到 color[0] 即可
    gl.bindFramebuffer(gl.FRAMEBUFFER, renderShadowMap ? null : frameBuffer);
    gl.viewport(0, 0, targetTextureWidth, targetTextureHeight);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(shadowMapProgramInfo.program);

    lights.forEach(l => l.calcProjectAndWorldToLightMatrix(scene));
    const distantLights = lights.filter(l => l instanceof DistantLight);
    const pointLights = lights.filter(l => l instanceof PointLight);

    for (let i = 0; i < meshes.length; i++) {
      let mesh = meshes[i];
      let {rotation, position} = mesh;
      let mRotTran = mat4.fromRotationTranslation(mat4.create(), quat.fromEuler(quat.create(), ...rotation), position);

      const uniformOfDistantLights = distantLights.reduce((acc, curr, idx) => {
          acc[`u_mat4_proj_w2l_transform[${idx}]`] = mat4.multiply(mat4.create(), curr.mat4_proj_w2l, mRotTran);
          return acc
        }, {});
      const uniformOfPointLights = pointLights.reduce((acc, curr, idx) => {
          let {mat4_proj_w2l_arr} = curr;
          acc[`u_mat4_proj_w2l_transform[${idx * 6    }]`] = mat4.multiply(mat4.create(), mat4_proj_w2l_arr[0], mRotTran);
          acc[`u_mat4_proj_w2l_transform[${idx * 6 + 1}]`] = mat4.multiply(mat4.create(), mat4_proj_w2l_arr[1], mRotTran);
          acc[`u_mat4_proj_w2l_transform[${idx * 6 + 2}]`] = mat4.multiply(mat4.create(), mat4_proj_w2l_arr[2], mRotTran);
          acc[`u_mat4_proj_w2l_transform[${idx * 6 + 3}]`] = mat4.multiply(mat4.create(), mat4_proj_w2l_arr[3], mRotTran);
          acc[`u_mat4_proj_w2l_transform[${idx * 6 + 4}]`] = mat4.multiply(mat4.create(), mat4_proj_w2l_arr[4], mRotTran);
          acc[`u_mat4_proj_w2l_transform[${idx * 6 + 5}]`] = mat4.multiply(mat4.create(), mat4_proj_w2l_arr[5], mRotTran);
          return acc
        }, {});

      let uniforms = Object.assign(uniformOfDistantLights, uniformOfPointLights);
      setUniforms(shadowMapProgramInfo.uniformSetters, uniforms);

      // let bufferInfo = shadowMapBufferInfos[i];
      // setBuffersAndAttributes(gl, shadowMapProgramInfo.attribSetters, bufferInfo);
      gl.bindVertexArray(shadowMapVaos[i]);

      gl.drawElements(gl.TRIANGLES, shadowMapBufferInfos[i].numElements, gl.UNSIGNED_SHORT, 0);
    }

    return this.shadowMapConf
  }
}
