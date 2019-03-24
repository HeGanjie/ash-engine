import {mat4, vec3} from "gl-matrix";
import mainVertShader from './shader/main-shader.vert'
import mainFragShader from './shader/main-shader.frag'
import distantLightVertShader from './shader/distant-light-shadow-map.vert'
import distantLightFragShader from './shader/distant-light-shadow-map.frag'
import {camera2World, mat4RotateXYZ, webglOrthographicProjectionMatrix, webglPerspectiveProjectionMatrix} from "./math";
import {
  createAttributeSetters, createBufferInfoFromArrays,
  createProgram, createProgramInfo,
  createUniformSetters,
  loadShader,
  setAttributes, setBuffersAndAttributes,
  setUniforms
} from "./webgl-utils";

let {PI, tan, floor, ceil, min, max} = Math;

const targetTextureWidth = 256;
const targetTextureHeight = 256;
const renderShadowMap = false;

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
    var programInfo = createProgramInfo(gl, [mainVertShader, mainFragShader]);

    let bufferInfos = scene.meshes.map(mesh => {
      let {faces, normals, vertices} = mesh;

      // 三角形坐标，不变化的话可以不重新写入数据到缓冲
      let position = faces.reduce((acc, f) => {
        let vA = vertices[f.A],
          vB = vertices[f.B],
          vC = vertices[f.C];
        acc.push(...vA, ...vB, ...vC);
        return acc;
      }, []);
      let normalPositions = faces.reduce((acc, f) => {
        let vAN = normals[f.AN],
          vBN = normals[f.BN],
          vCN = normals[f.CN];
        acc.push(...vAN, ...vBN, ...vCN);
        return acc;
      }, []);

      var arrays = {
        position: { numComponents: 3, data: position, },
        normal:   { numComponents: 3, data: normalPositions, },
      };

      return createBufferInfoFromArrays(gl, arrays);
    });

    this.webglConf = {
      programInfo,
      bufferInfos
    };
  }

  initShadowMapShader(scene, gl) {
    var vertexShader = loadShader(gl, distantLightVertShader, gl.VERTEX_SHADER);
    var fragmentShader = loadShader(gl, distantLightFragShader, gl.FRAGMENT_SHADER);
    var program = createProgram(gl, [vertexShader, fragmentShader]);

    var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    var matrixLocation = gl.getUniformLocation(program, "u_matrix");

    let positionBuffers = scene.meshes.map(mesh => {
      var positionBuffer = gl.createBuffer();
      let {vertices, faces} = mesh;
      // 三角形坐标，不变化的话可以不重新写入数据到缓冲
      let position = faces.reduce((acc, f) => {
        let vA = vertices[f.A],
          vB = vertices[f.B],
          vC = vertices[f.C];
        acc.push(...vA, ...vB, ...vC);
        return acc;
      }, []);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(position), gl.STATIC_DRAW);
      return positionBuffer;
    });

    if (renderShadowMap) {
      this.shadowMapConf = {
        program,
        positionAttributeLocation,
        matrixLocation,
        positionBuffers
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
      program,
      positionAttributeLocation,
      matrixLocation,
      positionBuffers,
      targetTexture,
      frameBuffer
    };
  }

  renderShadowMap(scene, gl) {
    if (!this.shadowMapConf) {
      this.initShadowMapShader(scene, gl);
    }
    let {
      program,
      positionAttributeLocation,
      matrixLocation,
      positionBuffers,
      targetTexture,
      frameBuffer
    } = this.shadowMapConf;
    // 计算 world to light space 矩阵
    // 计算平面投影矩阵（先要取得 l, r, t, b, n, f）
    // 绘制 shadowMap
    let {meshes, lights} = scene;
    let {direction: lightDirection} = lights[0];
    // TODO 计算实际边界
    let l2w = camera2World(
      mat4.create(),
      vec3.scale(vec3.create(), lightDirection, -3),
      lightDirection
    );
    let w2l = mat4.invert(mat4.create(), l2w); // 4 * 4
    let orthProjMatrix = webglOrthographicProjectionMatrix(6, -6, -6, 6, 1, 5.5);

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.viewport(0, 0, targetTextureWidth, targetTextureHeight);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(program);

    let op_w2l = mat4.multiply(mat4.create(), orthProjMatrix, w2l);
    this.shadowMapConf.op_w2l = op_w2l;

    for (let i = 0; i < meshes.length; i++) {
      let mesh = meshes[i];
      let {rotation, position} = mesh;
      let op_w2l_rot = mat4RotateXYZ(mat4.create(), op_w2l, ...rotation);
      let op_w2l_rot_trans = mat4.translate(op_w2l_rot, op_w2l_rot, position);

      gl.uniformMatrix4fv(matrixLocation, false, op_w2l_rot_trans);

      {
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[i]);

        // 告诉属性怎么从positionBuffer中读取数据 (ARRAY_BUFFER)
        let size = 3; // 每次迭代运行提取两个单位数据
        let type = gl.FLOAT; // 每个单位的数据类型是32位浮点型
        let normalize = false; // 不需要归一化数据
        let stride = 0; // 0 = 移动单位数量 * 每个单位占用内存（sizeof(type)）
        // 每次迭代运行运动多少内存到下一个数据开始点
        let offset = 0; // 从缓冲起始位置开始读取
        gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
      }

      let primitiveType = gl.TRIANGLES;
      let offset = 0;
      let count = mesh.faces.length * 3;
      gl.drawArrays(primitiveType, offset, count);
    }
  }

  render(scene, gl, fov = PI / 2) {
    if (renderShadowMap) {
      return this.renderShadowMap(scene, gl);
    }

    if (!this.webglConf) {
      this.initShader(scene, gl);
    }
    this.renderShadowMap(scene, gl);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let {
      programInfo,
      bufferInfos,
    } = this.webglConf;
    let {targetTexture, op_w2l} = this.shadowMapConf;
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

      // Draw the geometry.
      gl.drawArrays(gl.TRIANGLES, 0, bufferInfo.numElements);
    }
  }
}
