import {mat4, quat, vec3} from "gl-matrix";
import {createBufferInfoFromArrays, createProgramInfo, setBuffersAndAttributes, setUniforms} from "./webgl-utils";
import distantLightVertShader from "./shader/distant-light-shadow-map.vert";
import distantLightFragShader from "./shader/distant-light-shadow-map.frag";
import {flatMap, sumBy, take} from 'lodash'
import {Light} from "./engine";
import {renderShadowMap, targetTextureHeight, targetTextureWidth} from "./constants";

export class DistantLight extends Light {
  direction = null;

  constructor(l2w, color, intensity) {
    super(l2w, color, intensity);
    this.direction = vec3.fromValues(0, 0, -1);
    vec3.transformMat4(this.direction, this.direction, l2w)
  }

  getShadowLightDirection(out, pHit) {
    vec3.scale(out, this.direction, -1);
  }

  initShadowMapShader(scene, gl) {
    let programInfo = createProgramInfo(gl, [distantLightVertShader, distantLightFragShader]);

    let bufferInfos = scene.meshes.map(mesh => {
      let {vertices, faces} = mesh;
      // 三角形坐标，不变化的话可以不重新写入数据到缓冲
      let arrays = {
        position: {
          numComponents: 3,
          data: flatMap(faces, f => flatMap(f.data, ({V}) => [...vertices[V]]))
        },
        indices:  {
          numComponents: 3,
          data: flatMap(faces, (f, fIdx) => {
            let offset = sumBy(take(faces, fIdx), f => f.data.length);
            return f.triangleIndices.map(ti => ti + offset)
          })
        },
      };

      return createBufferInfoFromArrays(gl, arrays);
    });

    if (renderShadowMap) {
      this.shadowMapConf = {
        programInfo,
        bufferInfos
      };
      return;
    }

    // 创建渲染对象
    const targetTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);

    {
      // 定义 0 级的大小和格式
      const level = 0;
      const internalFormat = gl.RGBA;
      const border = 0;
      const format = gl.RGBA;
      const type = gl.UNSIGNED_BYTE;
      const data = null;
      gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        targetTextureWidth,
        targetTextureHeight,
        border,
        format,
        type,
        data
      );

      // 设置筛选器，不需要使用贴图
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, 0);

    this.shadowMapConf = {
      programInfo,
      bufferInfos,
      targetTexture,
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
      frameBuffer
    } = this.shadowMapConf;
    // 计算 world to light space 矩阵
    // 计算平面投影矩阵（先要取得 l, r, t, b, n, f）
    // 绘制 shadowMap
    let {meshes, lights} = scene;
    let {direction: lightDirection} = this;
    // TODO 计算实际边界
    let w2l = mat4.lookAt(mat4.create(),
      vec3.scale(vec3.create(), lightDirection, -3),
      lightDirection,
      vec3.fromValues(0, 1, 0));
    let orthProjMatrix = mat4.ortho(mat4.create(), -6, 6, -6, 6, 1, 5.5);

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.viewport(0, 0, targetTextureWidth, targetTextureHeight);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(shadowMapProgramInfo.program);

    let op_w2l = mat4.multiply(mat4.create(), orthProjMatrix, w2l);
    this.shadowMapConf.op_w2l = op_w2l;

    for (let i = 0; i < meshes.length; i++) {
      let mesh = meshes[i];
      let {rotation, position} = mesh;
      let mRotTran = mat4.fromRotationTranslation(mat4.create(), quat.fromEuler(quat.create(), ...rotation), position);
      let op_w2l_rot_trans = mat4.multiply(mRotTran, op_w2l, mRotTran);

      let uniforms = {
        u_mat4_op_w2l_transform: op_w2l_rot_trans,
      };
      setUniforms(shadowMapProgramInfo.uniformSetters, uniforms);

      let bufferInfo = shadowMapBufferInfos[i];
      setBuffersAndAttributes(gl, shadowMapProgramInfo.attribSetters, bufferInfo);

      gl.drawElements(gl.TRIANGLES, bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
    }

    return this.shadowMapConf
  }
}