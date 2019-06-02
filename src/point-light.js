import {mat4, vec3} from "gl-matrix";
import {targetTextureHeight, targetTextureWidth} from "./constants";
import Light from "./light";

const faceInfos = [
  {
    target: 'TEXTURE_CUBE_MAP_POSITIVE_X',
    direct: vec3.fromValues(1, 0, 0),
    up: vec3.fromValues(0, 1, 0)
  },
  {
    target: 'TEXTURE_CUBE_MAP_NEGATIVE_X',
    direct: vec3.fromValues(-1, 0, 0),
    up: vec3.fromValues(0, 1, 0)
  },
  {
    target: 'TEXTURE_CUBE_MAP_POSITIVE_Y',
    direct: vec3.fromValues(0, 1, 0),
    up: vec3.fromValues(0, 0, 1)
  },
  { target: 'TEXTURE_CUBE_MAP_NEGATIVE_Y',
    direct: vec3.fromValues(0, -1, 0),
    up: vec3.fromValues(0, 0, -1)
  },
  {
    target: 'TEXTURE_CUBE_MAP_POSITIVE_Z',
    direct: vec3.fromValues(0, 0, 1),
    up: vec3.fromValues(0, 1, 0)
  },
  {
    target: 'TEXTURE_CUBE_MAP_NEGATIVE_Z',
    direct: vec3.fromValues(0, 0, -1),
    up: vec3.fromValues(0, 1, 0)
  }
];

export class PointLight extends Light {
  position = null;
  texture = null;
  mat4_proj_w2l_arr = null;

  constructor(l2w, color, intensity) {
    super(l2w, color, intensity);
    this.position = vec3.fromValues(0, 0, 0);
    vec3.transformMat4(this.position, this.position, l2w)
  }

  getShadowLightDirection(out, pHit) {
    vec3.subtract(out, this.position, pHit);
    vec3.normalize(out, out);
  }

  initShadowMapTexture(gl) {
    let texture = gl.createTexture();
    this.texture = texture;
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    const level = 0;
    const internalFormat = gl.RGBA;
    const border = 0;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    const data = null;
    for (let i = 0; i < 6; i++) {
      gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, level, internalFormat,
        targetTextureWidth, targetTextureHeight, border, format, type, data);
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  }

  calcProjectAndWorldToLightMatrix(scene) {
    let {position: lightPosition} = this;
    this.mat4_proj_w2l_arr = faceInfos.map(fi => {
      let w2l = mat4.lookAt(mat4.create(), lightPosition, vec3.add(vec3.create(), lightPosition, fi.direct), fi.up);
      let ppMatrix = mat4.perspective(mat4.create(), Math.PI / 2, 1, 1, 25);
      return mat4.multiply(mat4.create(), ppMatrix, w2l);
    });
    return this.mat4_proj_w2l_arr
  }

}
