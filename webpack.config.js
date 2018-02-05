const path = require('path');
resolve: {
  extensions: [".js"]
}
module.exports = {
  module: {
    rules: [
      { test: /\.js$/, use: 'babel-loader' }
    ]
  },
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  }
};