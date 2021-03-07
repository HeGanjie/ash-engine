import {vec3, mat4, vec2, quat} from "gl-matrix";
import {buildShader, SHADER_IMPLEMENT_STRATEGY} from "./shader-impl";
import {
  createBufferInfoFromArrays,
  createProgramInfo,
  resizeCanvasToDisplaySize,
  setBuffersAndAttributes,
  setUniforms
} from "./webgl-utils";
import {flatten, flatMap, uniqBy, sum, isEqual} from "lodash";

export class RayTracingCamera {
  position = vec3.create();
  target = vec3.create();
  up = vec3.fromValues(0, 1, 0)
  fov = Math.PI / 2;
  rayTracingProgramInfo = null
  outputProgramInfo = null
  bufferInfo = null
  uniformDict = {}
  // 由于 webgl 限制不能同时读写同一个材质，所以用两个材质交替着读写
  offScreenTextures = []
  offScreenTextureWriteCursor = 0
  offScreenFrameBuffer = null
  renderCount = 0
  prevPosition = this.position
  prevTarget = this.target
  beginTime = Date.now()

  constructor() {
  }

  initShader(scene, gl) {
    let [vert, frag] = buildShader(SHADER_IMPLEMENT_STRATEGY.rayTracing, {
      NUM_VERTICES_COUNT: scene.meshes.reduce((acc, m) => acc + m.geometry.vertices.length, 0),
      NUM_FACES_COUNT: scene.meshes.reduce((acc, m) => acc + m.geometry.faces.length, 0),
      NUM_MESHES_COUNT: scene.meshes.length,
      NUM_LIGHT_FACE_COUNT: scene.meshes.filter(m => m.material.selfLuminous[0] > 0)
        .reduce((acc, m) => acc + m.geometry.faces.length, 0),
      NUM_MATERIALS_COUNT: uniqBy(scene.meshes.map(m => m.material), m => m.id).length
    })
    this.rayTracingProgramInfo = createProgramInfo(gl, [vert, frag])

    // TODO 窗口大小变化时重置贴图大小
    // 创建纹理，用于累加计算，创建
    // 定义 0 级的大小和格式
    const level = 0;
    const internalFormat = gl.RGBA;
    const border = 0;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    const data = null;
    this.offScreenTextures[0] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.offScreenTextures[0]);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, gl.canvas.width, gl.canvas.height, border, format, type, data);
    // 设置筛选器，不需要使用贴图
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.offScreenTextures[1] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.offScreenTextures[1]);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, gl.canvas.width, gl.canvas.height, border, format, type, data);
    // 设置筛选器，不需要使用贴图
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.offScreenTextureWriteCursor = 0
    // 创建并绑定帧缓冲
    this.offScreenFrameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.offScreenFrameBuffer);
    // 附加纹理为第一个颜色附件
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, this.offScreenTextures[this.offScreenTextureWriteCursor], level);
  }

  initRenderTextureShader(scene, gl) {
    let [vert, frag] = buildShader(SHADER_IMPLEMENT_STRATEGY.renderTexture, {})
    this.outputProgramInfo = createProgramInfo(gl, [vert, frag])
  }

  initBuffer(scene, gl) {
    // 裁剪空间的坐标范围永远是 -1 到 1，https://webglfundamentals.org/webgl/lessons/zh_cn/webgl-fundamentals.html

    let vertices = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]
    let arrays = {
      position: {
        numComponents: 2,
        data: flatten(vertices)
      },
      indices:  {
        numComponents: 3,
        data: [
          0, 1, 2,
          2, 3, 0
        ]
      },
    };

    const bufferInfo = createBufferInfoFromArrays(gl, arrays)
    this.bufferInfo = bufferInfo
  }

  renderRayTracing(scene, gl) {
    resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.offScreenFrameBuffer);
    // 附加纹理为第一个颜色附件
    const level = 0;
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, this.offScreenTextures[this.offScreenTextureWriteCursor], level);

    // 视角变化后需要重置 renderCount
    if (!isEqual(this.position, this.prevPosition) || !isEqual(this.target, this.prevTarget)) {
      this.renderCount = 0
    }
    vec3.copy(this.prevPosition, this.position)
    vec3.copy(this.prevTarget, this.target)
    if (this.renderCount === 0) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    if (!this.rayTracingProgramInfo) {
      this.initShader(scene, gl);
    }
    if (!this.bufferInfo) {
      this.initBuffer(scene, gl)
    }
    gl.useProgram(this.rayTracingProgramInfo.program);

    const uniformDict = this.uniformDict;
    uniformDict.u_resolution = vec2.set(uniformDict.u_resolution || vec2.create(), gl.canvas.width, gl.canvas.height)
    uniformDict.u_eye_pos = this.position
    uniformDict.u_fov = this.fov
    uniformDict.u_cam_to_world = mat4.targetTo(uniformDict.u_cam_to_world || mat4.create(), this.position, this.target, this.up)
    // TODO optimize gc
    uniformDict.u_vertices = uniformDict.u_vertices || flatMap(scene.meshes, m => flatMap(m.geometry.vertices, v => [...v]))
    let verticesOffset = 0
    uniformDict.u_indices = uniformDict.u_indices || flatMap(scene.meshes, m => {
      let result = flatMap(m.geometry.faces, f => f.data.map(d => d.V + verticesOffset));
      verticesOffset += m.geometry.vertices.length
      return result
    })
    uniformDict.u_face_normals = uniformDict.u_face_normals || flatMap(scene.meshes, m => {
      return flatMap(m.geometry.faces, f => [...f.normal])
    })
    uniformDict.u_face_material_ids = uniformDict.u_face_material_ids || flatMap(scene.meshes, m => {
      return m.geometry.faces.map(() => m.material.id);
    })
    uniformDict.u_local_to_world_matrixs = uniformDict.u_local_to_world_matrixs || flatMap(scene.meshes, m => {
      let {rotation, position, scale} = m;
      let qRot = quat.fromEuler(quat.create(), ...rotation)
      return [...mat4.fromRotationTranslationScale(mat4.create(), qRot, position, scale)]
    })
    uniformDict.u_material_colors = uniformDict.u_material_colors || flatMap(uniqBy(scene.meshes.map(m => m.material), m => m.id), m => {
      let {r, g, b} = m.color
      return [r, g, b]
    })
    uniformDict.u_material_emits = uniformDict.u_material_emits || flatMap(uniqBy(scene.meshes.map(m => m.material), m => m.id), m => {
      return [...m.selfLuminous]
    })
    let faceOffset = 0
    uniformDict.u_lightFaceIdx = uniformDict.u_lightFaceIdx || flatMap(scene.meshes, m => {
      let res = m.material.selfLuminous[0] <= 0 ? [] : m.geometry.faces.map((f, fi) => faceOffset + fi)
      faceOffset += m.geometry.faces.length
      return res
    })
    uniformDict.u_areaOfLightFace = uniformDict.u_areaOfLightFace || flatMap(scene.meshes, m => {
      return m.material.selfLuminous[0] <= 0 ? [] : m.geometry.faces.map(f => f.area)
    })
    uniformDict.u_areaOfLightSum = uniformDict.u_areaOfLightSum || sum(uniformDict.u_areaOfLightFace)
    uniformDict.u_ran = vec2.set(uniformDict.u_ran || vec2.create(), Math.random(), Math.random())
    uniformDict.u_prevResult = this.offScreenTextures[(this.offScreenTextureWriteCursor + 1) % 2]
    uniformDict.u_renderCount = this.renderCount++
    uniformDict.u_time = (Date.now() - this.beginTime) / 1000

    setUniforms(this.rayTracingProgramInfo.uniformSetters, uniformDict);
    setBuffersAndAttributes(gl, this.rayTracingProgramInfo.attribSetters, this.bufferInfo);
    gl.drawElements(gl.TRIANGLES, this.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
  }

  renderTexture(scene, gl) {
    if (!this.outputProgramInfo) {
      this.initRenderTextureShader(scene, gl);
    }
    if (!this.bufferInfo) {
      this.initBuffer(scene, gl)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(this.outputProgramInfo.program);

    const uniformDict = this.uniformDict;
    uniformDict.u_offScreenTexture = this.offScreenTextures[this.offScreenTextureWriteCursor]

    setUniforms(this.outputProgramInfo.uniformSetters, uniformDict);
    setBuffersAndAttributes(gl, this.outputProgramInfo.attribSetters, this.bufferInfo);
    gl.drawElements(gl.TRIANGLES, this.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
  }

  render(scene, gl) {
    // 渲染到光线跟踪累加贴图
    this.renderRayTracing(scene, gl)

    // 把累加贴图渲染到 canvas
    this.renderTexture(scene, gl)

    this.offScreenTextureWriteCursor = (this.offScreenTextureWriteCursor + 1) % 2
  }
}
