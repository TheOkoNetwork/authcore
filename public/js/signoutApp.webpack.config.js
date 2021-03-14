const path = require('path')
//to build me npx webpack --config signoutApp.webpack.config.js

module.exports = {
  entry: './src/signoutApp.js',
  devtool: 'source-map',
  output: {
    filename: 'signoutApp.js',
    path: path.resolve(__dirname, 'dist')
  }
}
