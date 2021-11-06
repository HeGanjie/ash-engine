import Stats from 'stats.js'
import gameShell from 'game-shell'
import FirstPersonCameraCtrl from './first-person-camera-ctrl'
import {vec2} from 'gl-matrix'


let shell = gameShell({pointerLock: true})
let stats, sceneCtrl, ctx, cameraCtrl

shell.bind("move-left", "left", "A")
shell.bind("move-right", "right", "D")
shell.bind("move-up", "up", "W")
shell.bind("move-down", "down", "S")

shell.on("init", async () => {
  stats = new Stats()
  stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.dom)

  let canvas = document.getElementById('canvas')
  ctx = canvas.getContext('webgl2')

  if (!ctx) {
    throw new Error('Not support webgl2')
  }
  let watchScene = (window.location.search || '').match(/scene=(\d+)/)?.[1] || 3
  let sceneImportFn = [
    () => import('./scene1-rotating-cube'),
    () => import('./scene2-bloom-effect'),
    () => import('./scene3-pbr'),
    () => import('./scene4-cornellbox'),
    () => import('./scene5-veach')
  ][watchScene]
  let sceneGenFn = (await sceneImportFn()).default
  sceneCtrl = await sceneGenFn()

  cameraCtrl = new FirstPersonCameraCtrl({
    position: sceneCtrl.camera.position,
    target: sceneCtrl.camera.target,
    positionSpeed: +watchScene === 3 ? 100000 : 1000
  })
})

shell.on("render", (frame_time) => {
  if (!sceneCtrl || !ctx) {
    return
  }
  stats.begin()
  sceneCtrl.onFrame(ctx)
  stats.end()
})

const ctrlFlags = [], mousePos = vec2.create(), prevMousePos = vec2.create()
shell.on("tick", function() {
  if (!sceneCtrl || !ctx) {
    return
  }

    ctrlFlags.length = 0
    ctrlFlags.push(
      this.down('W'), this.down('S'),
      this.down('A'), this.down('D'),
      this.down('space'), this.down('shift'),
    )
    cameraCtrl.control(this.tickTime, ctrlFlags,
      vec2.set(mousePos, this.mouseX, this.mouseY),
      vec2.set(prevMousePos, this.prevMouseX, this.prevMouseY))

  sceneCtrl.camera.position = cameraCtrl.position
  sceneCtrl.camera.target = cameraCtrl.target
/*
  if (_.some(ctrlFlags, _.identity)) {
    console.log(`cameraPos: `, cameraCtrl.position, `, cameraTarget: `, cameraCtrl.target)
  }
*/
})
