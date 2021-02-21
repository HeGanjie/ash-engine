import {vec3, mat4, vec2} from "gl-matrix";
import {buildShader, SHADER_IMPLEMENT_STRATEGY} from "./shader-impl";
import {
  createBufferInfoFromArrays,
  createProgramInfo,
  resizeCanvasToDisplaySize,
  setBuffersAndAttributes,
  setUniforms
} from "./webgl-utils";
import {flatten, flatMap} from "lodash";

export class RayTracingCamera {
  position = vec3.create();
  target = vec3.create();
  up = vec3.fromValues(0, 1, 0)
  fov = Math.PI / 2;
  programInfo = null
  bufferInfo = null
  uniformDict = {}

  constructor() {
  }

  initShader(scene, gl) {
    let [vert, frag] = buildShader(SHADER_IMPLEMENT_STRATEGY.rayTracing, {})
    this.programInfo = createProgramInfo(gl, [vert, frag])
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

  render(scene, gl) {
    resizeCanvasToDisplaySize(gl.canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    if (!this.programInfo) {
      this.initShader(scene, gl);
    }
    if (!this.bufferInfo) {
      this.initBuffer(scene, gl)
    }
    gl.useProgram(this.programInfo.program);

    const uniformDict = this.uniformDict;
    uniformDict.u_resolution = vec2.set(uniformDict.u_resolution || vec2.create(), gl.canvas.width, gl.canvas.height)
    uniformDict.u_eye_pos = this.position
    uniformDict.u_fov = this.fov
    uniformDict.u_cam_to_world = mat4.targetTo(uniformDict.u_cam_to_world || mat4.create(), this.position, this.target, this.up)
    setUniforms(this.programInfo.uniformSetters, uniformDict);
    setBuffersAndAttributes(gl, this.programInfo.attribSetters, this.bufferInfo);
    gl.drawElements(gl.TRIANGLES, this.bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
  }
}
