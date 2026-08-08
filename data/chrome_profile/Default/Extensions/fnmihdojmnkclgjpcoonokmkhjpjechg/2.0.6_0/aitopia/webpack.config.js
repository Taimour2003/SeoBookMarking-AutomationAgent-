module.exports = {
  entry: ['./dist_partner/service-worker-loader.js'],
  output: {
    filename: 'bundle.js'
  },
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map'
};
