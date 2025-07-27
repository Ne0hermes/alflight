const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/main.jsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      'pdfjs-dist': path.join(__dirname, 'node_modules/pdfjs-dist')
    }
  },
  
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react', '@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader']
      },
      {
        test: /\.worker\.js$/,
        use: { 
          loader: 'worker-loader',
          options: {
            filename: '[name].[contenthash].worker.js'
          }
        }
      }
    ]
  },
  
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/pdfjs-dist/build/pdf.worker.js',
          to: 'pdf.worker.js'
        }
      ]
    })
  ],
  
  devServer: {
    static: './dist',
    hot: true,
    port: 3000
  }
};