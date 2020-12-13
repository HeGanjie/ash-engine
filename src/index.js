import Stats from 'stats.js'
import gameShell from 'game-shell'
import genScene from './scene3'
import FirstPersonCameraCtrl from './first-person-camera-ctrl'


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
  sceneCtrl = await genScene()

  cameraCtrl = new FirstPersonCameraCtrl({
    position: sceneCtrl.camera.position,
    target: sceneCtrl.camera.target
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

shell.on("tick", function() {
  if (!sceneCtrl || !ctx) {
    return
  }
  cameraCtrl.control(this.tickTime, [
    this.down('W'), this.down('S'),
    this.down('A'), this.down('D'),
    this.down('space'), this.down('shift'),
  ], [this.mouseX, this.mouseY], [this.prevMouseX, this.prevMouseY])

  sceneCtrl.camera.position = cameraCtrl.position
  sceneCtrl.camera.target = cameraCtrl.target
})
