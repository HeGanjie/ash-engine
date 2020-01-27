import {lambertShaderImpl} from './lambert-shader'
import {diffuseMapShaderImpl} from './diffuse-map-shader'
import {shadowMapShaderImpl} from './shadow-map-shader'
import {pbrShaderImpl} from './pbr-shader'

export const SHADER_IMPLEMENT_STRATEGY = {
  diffuseMap: 'diffuseMap',
  pbr: 'pbr',
  lambert: 'lambert',
  shadowMap: 'shadowMap'
}

const SHADER_IMPLEMENT_DICT = {
  diffuseMap: diffuseMapShaderImpl,
  pbr: pbrShaderImpl,
  lambert: lambertShaderImpl,
  shadowMap: shadowMapShaderImpl
}

export function buildShader(key, consts = {}) {
  const {vert, frag} = SHADER_IMPLEMENT_DICT[key]
  const finalShaders = [vert, frag].map(str => {
    return Object.keys(consts).reduce((acc, curr) => acc.replace(new RegExp(curr, 'g'), consts[curr]), str)
  })
  return finalShaders
}

export function genUniforms(material) {
  return SHADER_IMPLEMENT_DICT[material.shaderImpl]?.genUniforms?.(material) || {}
}
