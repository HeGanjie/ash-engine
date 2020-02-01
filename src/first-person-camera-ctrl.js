// 参考了：https://github.com/shama/first-person-camera/blob/master/first-person-camera.js
import {mat4, quat, vec3} from 'gl-matrix'

export default class FirstPersonCameraCtrl {
  position = null
  target = null
  positionSpeed = 1000
  rotationSpeed = 0.1

  constructor(opts) {
    Object.assign(this, opts)
  }

  control(dt, move, mouse, prevMouse) {
    let [forward, backward, left, right, up, down] = move
    let speed = (this.positionSpeed / 1000) * dt
    let dir = [0,0,0]
    if (forward) dir[2] -= speed
    else if (backward) dir[2] += speed
    if (left) dir[0] -= speed
    else if (right) dir[0] += speed
    if (up) dir[1] += speed
    else if (down) dir[1] -= speed
    this.move(dir)
    this.pointer(mouse, prevMouse)
  }

  genTransformMatrix() {
    // camera to world ?
    let backward = vec3.subtract(vec3.create(), this.position, this.target)
    vec3.normalize(backward, backward)
    let right = vec3.cross(vec3.create(), vec3.fromValues(0, 1, 0), backward)
    let up = vec3.cross(vec3.create(), backward, right)

    let m = mat4.fromValues(...right, 0, ...up, 0, ...backward, 0, 0, 0, 0, 1)
    return m
  }

  move(dir) {
    if (dir[0] === 0 && dir[1] === 0 && dir[2] === 0) {
      return
    }

    let delta = vec3.transformMat4(vec3.create(), dir, this.genTransformMatrix())

    vec3.add(this.position, this.position, delta)
    vec3.add(this.target, this.target, delta)
  }

  pointer(da, db) {
    let [dX, dY] = [da[0] - db[0], da[1]- db[1]]
    if (dX === 0 || dY === 0) {
      return
    }

    // rotate 0,0,-1; c2w;
    let mRot = mat4.fromRotationTranslation(mat4.create(), quat.fromEuler(quat.create(), -dY * this.rotationSpeed, -dX * this.rotationSpeed, 0), vec3.fromValues(0, 0, 0))
    let towards = vec3.fromValues(0, 0, -1)
    vec3.transformMat4(towards, towards, mRot)
    vec3.transformMat4(towards, towards, this.genTransformMatrix())

    vec3.add(this.target, this.position, towards)
  }
}
