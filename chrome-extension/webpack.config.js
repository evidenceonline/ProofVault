const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background.js',
    popup: './src/popup.js',
    options: './src/options.js',
    content: './src/content.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'manifest.json' },
        { from: 'src/icons', to: 'icons' },
        { from: 'src/styles', to: 'styles' }
      ]
    }),
    new HtmlWebpackPlugin({
      template: 'src/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
      inject: true
    }),
    new HtmlWebpackPlugin({
      template: 'src/options.html',
      filename: 'options.html',
      chunks: ['options'],
      inject: true
    })
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10
        }
      }
    }
  }
};