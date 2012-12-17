var fs = require('fs');
var assert = require('assert');
var child_process = require('child_process');
var fsdocs = require('../fsdocs');

var datadir = __dirname + '/data';

function clear(done) {
  fs.exists(datadir, function(yes) {
    if (yes) {
      var p = child_process.spawn('rm', ['-rf', datadir]);
      p.on('exit', function(code) {
        var error;
        if (code == 0) {
          create(done);
        } else {
          error = new Error('Could not remove data directory: rm exited with code ' + code);
          done(error);
        }
      });
    } else {
      create(done);
    }
  });
}

function create(done) {
  var mode = 0777 - process.umask();
  fs.mkdir(datadir, mode, done);
}

// Important: each test should use its own data directory

describe('FSDocs', function() {
  before(clear);
  
  it('Should report nonexisting documents as missing', function() {
    var docs = new fsdocs.FSDocs(datadir + '/missing');
    
    docs.get('nonexistent', function(err, document) {
      assert(err === null);
      assert(document === null);
    });
  });
  
  it('Should be able to put and get documents asynchronously', function() {
    var docs = new fsdocs.FSDocs(datadir + '/get-put-async');
    
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
    var docs = new fsdocs.FSDocs(datadir + '/get-put-sync');
    var ok, document;
    
    document = docs.getSync('test-doc');
    assert(document === null);
    
    ok = docs.putSync('test-doc', {hello: 'world'});
    assert(ok);
    
    document = docs.getSync('test-doc');
    assert(document);
    assert.equal('world', document.hello);
  });
  
  it('Should refuse to write the same version twice', function() {
    var docs = new fsdocs.FSDocs(datadir + '/conflict-detect');
    
    docs.put('test-doc', {hello: 'world'}, function(err, ok) {
      assert(!err);
      assert(ok);
      
      docs.put('test-doc', {hello: 'world'}, function(err, ok) {
        assert(err);
      });
    });
  });
});
