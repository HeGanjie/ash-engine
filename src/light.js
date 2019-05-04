export default class Light {
  lightToWorld = null;
  color = null;
  intensity = 1;

  constructor(l2w, color, intensity) {
    this.lightToWorld = l2w;
    this.color = color;
    this.intensity = intensity;
  }
}