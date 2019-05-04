import {mat4, quat, vec3} from "gl-matrix";
import {targetTextureHeight, targetTextureWidth} from "./constants";
import Light from "./light";

export class DistantLight extends Light {
  direction = null;
  texture = null;
  mat4_proj_w2l = null;

  constructor(l2w, color, intensity) {
    super(l2w, color, intensity);
    this.direction = vec3.fromValues(0, 0, -1);
    vec3.transformMat4(this.direction, this.direction, l2w)
  }

  getShadowLightDirection(out, pHit) {
    vec3.scale(out, this.direction, -1);
  }

  initShadowMapTexture(gl) {
    // 创建渲染对象
    const targetTexture = gl.createTexture();
    this.texture = targetTexture;
    // gl.activeTexture(gl.TEXTURE0);
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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
  }

  calcProjectAndWorldToLightMatrix(scene) {
    let {direction: lightDirection} = this;
    // TODO 计算实际边界
    let w2l = mat4.lookAt(mat4.create(),
      vec3.scale(vec3.create(), lightDirection, -3),
      lightDirection,
      vec3.fromValues(0, 1, 0));
    let orthProjMatrix = mat4.ortho(mat4.create(), -6, 6, -6, 6, 1, 5.5);
    let op_w2l = mat4.multiply(mat4.create(), orthProjMatrix, w2l);
    this.mat4_proj_w2l = op_w2l;
    return op_w2l
  }
}
