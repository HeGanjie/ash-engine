import {mat4, quat, vec3} from "gl-matrix";
import mainVertShader from './shader/main-shader.vert'
import mainFragShader from './shader/main-shader.frag'
import {
  createBufferInfoFromArrays,
  createProgramInfo,
  createVAOFromBufferInfo,
  resizeCanvasToDisplaySize,
  setUniforms
} from './webgl-utils'
import {flatMap, sumBy, take, isNil, isEmpty} from 'lodash'
import {DistantLight} from "./distant-light";
import ShadowMapRenderer from "./shadow-map-renderer";
import {PointLight} from "./point-light";

let {PI, tan, floor, ceil, min, max} = Math;

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

export class Camera {
  position = vec3.create();
  target = vec3.create();
  nearClippingPlaneDistance = 0.1;
  farClippingPlaneDistance = 1000;
  shadowMapRenderer = null;

  constructor(nearClippingPlaneDistance = 0.1, farClippingPlaneDistance = 1000) {
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
          .replace(/NUM_SHADOW_MAPS/g, numDistantLightCount + numPointLightCount * 6)
      });
    let programInfo = createProgramInfo(gl, shaderSources);

    const srcImg = scene.mainTexture
    let mainWebglTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, mainWebglTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcImg)

    // Check if the image is a power of 2 in both dimensions.
    if (isPowerOf2(srcImg.width) && isPowerOf2(srcImg.height)) {
      // Yes, it's a power of 2. Generate mips.
      gl.generateMipmap(gl.TEXTURE_2D)
    } else {
      // No, it's not a power of 2. Turn off mips and set wrapping to clamp to edge
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    }

    let bufferInfos = scene.meshes.map(mesh => {
      let {faces, normals, vertices} = mesh.geometry;
      let {diffuseMapTexcoords, specularMapTexcoords} = mesh.material
      // 三角形坐标，不变化的话可以不重新写入数据到缓冲
      let arrays = {
        position: {
          numComponents: 3,
          data: flatMap(faces, f => flatMap(f.data, ({V}) => [...vertices[V]]))
        },
        diffuse_texcoord: {
          numComponents: 2,
          data: flatMap(faces, f => flatMap(f.data, ({T}) => {
            return isNil(T) || isEmpty(diffuseMapTexcoords) ? [0, 0] : [...diffuseMapTexcoords[T]]
          }))
        },
        specular_texcoord: {
          numComponents: 2,
          data: flatMap(faces, f => flatMap(f.data, ({TS}) => {
            return isNil(TS) || isEmpty(specularMapTexcoords) ? [0, 0] : [...specularMapTexcoords[TS]]
          }))
        },
        normal: {
          numComponents: 3,
          data: flatMap(faces, f => flatMap(f.data, ({N}) => [...normals[N]])),
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

    this.webglConf = {
      programInfo,
      bufferInfos,
      mainTexture: mainWebglTexture,
      vaos: bufferInfos.map(bi => createVAOFromBufferInfo(gl, programInfo, bi)),
      numDistantLightCount
    };
  }

  render(scene, gl, fov = PI / 2) {
    this.shadowMapRenderer.renderShadowMap(scene, gl);
    let {
      numShadowMapTextureCount,
      texture2dArr
    } = this.shadowMapRenderer.shadowMapConf;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (!this.webglConf) {
      this.initShader(scene, gl);
    }
    let {
      programInfo,
      bufferInfos,
      mainTexture,
      vaos,
      numDistantLightCount
    } = this.webglConf;
    resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(programInfo.program);

    let w2c = mat4.lookAt(mat4.create(), this.position, this.target, vec3.fromValues(0, 1, 0));
    let ppMatrix = mat4.perspective(mat4.create(), fov, gl.canvas.width / gl.canvas.height, 1, 20);
    let pp_w2c = mat4.multiply(mat4.create(), ppMatrix, w2c);

    const uniformOfLights = scene.lights
      .reduce((acc, currLight, idx) => {
        if (currLight instanceof DistantLight) {
          let {direction, color, intensity, mat4_proj_w2l} = currLight;
          acc[`u_distantLights[${idx}].direction`] = direction;
          acc[`u_distantLights[${idx}].color`] = vec3.fromValues(color.r, color.g, color.b);
          acc[`u_distantLights[${idx}].intensity`] = intensity;
          // acc[`u_distantLights[${idx}].op_w2l_transform`] = mat4_proj_w2l; // bind later
          acc[`u_distantLights[${idx}].reverseLightDirection`] = vec3.scale(vec3.create(), direction, -1);
        } else if (currLight instanceof PointLight) {
          let {position, color, intensity, mat4_proj_w2l_arr} = currLight;
          let pointLightIdx = idx - numDistantLightCount;
          acc[`u_pointLights[${pointLightIdx}].position`] = position;
          acc[`u_pointLights[${pointLightIdx}].color`] = vec3.fromValues(color.r, color.g, color.b);
          acc[`u_pointLights[${pointLightIdx}].intensity`] = intensity;
          // acc[`u_pointLights[${pointLightIdx}].proj_w2l_transform`] = mat4_proj_w2l; // bind later
        } else {
          throw new Error('Unknown light')
        }
        return acc
      }, {});
    let uniforms = Object.assign({
      u_texShadowMapArr: texture2dArr,
      u_cameraPos: this.position,
    }, uniformOfLights);
    setUniforms(programInfo.uniformSetters, uniforms);

    for (let i = 0; i < scene.meshes.length; i++) {
      let mesh = scene.meshes[i];
      let {rotation, position, scale} = mesh;
      let {albedo, kD, kS, specularExp} = mesh.material;
      let qRot = quat.fromEuler(quat.create(), ...rotation)
      let mRo = mat4.fromQuat(mat4.create(), qRot);
      let mTransform = mat4.fromRotationTranslationScale(mat4.create(), qRot, position, scale);

      let pp_w2c_transform = mat4.multiply(mat4.create(), pp_w2c, mTransform);

      let m4_w2c_rot = mat4.multiply(mat4.create(), w2c, mRo);

      let uniforms = Object.assign({
          u_albedoDivPI: albedo / Math.PI,
          u_kd: kD,
          u_ks: kS,
          u_specularExp: specularExp,
          u_mat4_pp_w2c_transform: pp_w2c_transform,
          u_mat4_transform: mTransform,
          u_mat4_w2c_rot_inv_T: mat4.transpose(m4_w2c_rot, mat4.invert(m4_w2c_rot, m4_w2c_rot)),
          u_mainTexture: mainTexture
        },
        scene.lights
          .filter(l => l instanceof DistantLight)
          .reduce((acc, curr, idx) => {
            acc[`u_distantLights[${idx}].op_w2l_transform`] = mat4.multiply(mat4.create(), curr.mat4_proj_w2l, mTransform);
            return acc
          }, {}),
        scene.lights
          .filter(l => l instanceof PointLight)
          .reduce((acc, curr, idx) => {
            let {mat4_proj_w2l_arr} = curr;
            let mergedData = flatMap(mat4_proj_w2l_arr, ppW2l => {
              let m = mat4.multiply(mat4.create(), ppW2l, mTransform);
              return [...m]
            });
            acc[`u_pointLights[${idx}].proj_w2l_transform`] = mergedData;
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
