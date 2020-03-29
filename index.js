const Bundler = require('parcel-bundler')

/*
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
let bundler = new Bundler('index.html', {
  production: true,
  throwErrors: false,
  scopeHoist: false,
  target: 'browser'
})
bundler.bundle();
*/
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
let bundler2 = new Bundler('index.html', {
  production: false,
  throwErrors: false,
  scopeHoist: false,
  target: 'browser'
})
bundler2.serve(8080, false);
