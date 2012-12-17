var assert = require('assert');
var child_process = require('child_process');
var fsdocs = require('../fsdocs');

var datadir = __dirname + '/data';

function clear(done) {
  var p = child_process.spawn('rm', ['-rf', datadir]);
  p.on('exit', function(code) {
    var error;
    if (code == 0) {
      error = null;
    } else {
      error = new Error('Could not remove data directory: rm exited with code ' + code);
    }
    done(error);
  });
}

describe('FSDocs', function() {
  before(clear);
  
  it('Should report nonexisting documents as missing', function() {
    var docs = new fsdocs.FSDocs(datadir);
    
    docs.get('nonexistent', function(err, document) {
      assert(err);
      assert.equal('ENOENT', err.code);
    });
  });
  
  it('Should be able to put and get documents asynchronously', function() {
    var docs = new fsdocs.FSDocs(datadir);
    
    docs.put('test-doc', {hello: 'world'}, function(err, ok) {
      assert(!err);
      assert(ok);
      
      docs.get('test-doc', function(err, document) {
        assert(!err);
        assert(document);
        assert.equal('world', document.hello);
      });
    });
  });
  
  it('Should be able to put and get documents synchronously', function() {
    var docs = new fsdocs.FSDocs(datadir);
    var ok, document;
    
    assert.throws(function() {
      docs.getSync('test-doc');
    }, Error.ENOENT);
    
    ok = docs.putSync('test-doc', {hello: 'world'});
    assert(ok);
    
    document = docs.getSync('test-doc');
    assert(document);
    assert.equal('world', document.hello);
  });
  
  it('Should refuse to write the same version twice', function() {
    var docs = new fsdocs.FSDocs(datadir);
    
    docs.put('test-doc', {hello: 'world'}, function(err, ok) {
      assert(!err);
      assert(ok);
      
      docs.put('test-doc', {hello: 'world'}, function(err, ok) {
        assert(err);
      });
    });
  });
});
