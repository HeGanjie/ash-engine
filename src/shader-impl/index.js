import {lambertShaderImpl} from './lambert-shader'
import {diffuseMapShaderImpl} from './diffuse-map-shader'
import {shadowMapShaderImpl} from './shadow-map-shader'

export const SHADER_IMPLEMENT_STRATEGY = {
  diffuseMap: 'diffuseMap',
  lambert: 'lambert',
  shadowMap: 'shadowMap'
}

const SHADER_IMPLEMENT_DICT = {
  diffuseMap: diffuseMapShaderImpl,
  lambert: lambertShaderImpl,
  shadowMap: shadowMapShaderImpl
}

export function buildShader(key, consts = {}) {
  const {vert, frag} = SHADER_IMPLEMENT_DICT[key]
  const finalShaders = [vert, frag].map(str => {
    let res = Object.keys(consts).reduce((acc, curr) => acc.replace(new RegExp(curr, 'g'), consts[curr]), str)
    return res
  })
  return finalShaders
}