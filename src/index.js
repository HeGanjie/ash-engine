import Stats from 'stats.js'
import genScene from './scene3'

var stats = new Stats()
stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom)

let canvas = document.getElementById('canvas')
let ctx = canvas.getContext('webgl2')

if (!ctx) {
  throw new Error('Not support webgl2')
}

genScene().then(({onFrame}) => {

  function drawingLoop() {
    stats.begin()
    onFrame(ctx)

    stats.end()
    requestAnimationFrame(drawingLoop)
  }

  requestAnimationFrame(drawingLoop)
  // setInterval(drawingLoop, 5000);
})

