const path = require('path')
//to build me npx webpack --config signinApp.webpack.config.js

module.exports = {
  entry: './src/signinApp.js',
  devtool: 'source-map',
  output: {
    filename: 'signinApp.js',
    path: path.resolve(__dirname, 'dist')
  }
}
