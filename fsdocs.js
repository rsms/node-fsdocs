/**
 * Simple but ACID file system-based document database.
 *
 * Copyright (c) 2011 Rasmus Andersson <http://rsms.me/>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
var fs = require('fs');

function FSDocs(location) {
  this.location = require('path').normalize(location);
  this.prefixLength = 0;
  // FIXME: move into an open method or something like that
  try {
    fs.mkdirSync(this.location, 0700);
  } catch (e) { if (typeof e !== 'object' || e.errno !== 17) throw e; }
}

FSDocs.prototype = {
  entryPath: function(key) {
    var basename = this.location+'/';
    if (this.prefixLength && key.length > this.prefixLength) {
      basename += key.substr(0, this.prefixLength)+'/'+
                  key.substr(this.prefixLength);
    } else {
      basename += key;
    }
    return basename;
  },
  
  mkdirsSync: function(dirname, mode) {
    var p = 0;
    dirname = dirname.substr(this.location.length+1) + '/';
    while ((p = dirname.indexOf('/', ++p)) !== -1) {
      try {
        fs.mkdirSync(this.location+'/'+dirname.substr(0, p), mode);
      } catch (e) { if (typeof e !== 'object' || e.errno !== 17) throw e; }
    }
  },
  
  mkdirs: function(dirname, mode, callback) {
    var p = 0, location = this.location;
    dirname = dirname.substr(location.length+1) + '/';
    var next = function () {
      p = dirname.indexOf('/', ++p);
      if (p === -1) return callback();
      fs.mkdir(location+'/'+dirname.substr(0, p), mode, function (err) {
        if (err && (typeof err !== 'object' || err.errno !== 17)) {
          callback(err);
        } else {
          next();
        }
      });
    }
    next();
  },
  
  get: function(key, version, callback) {
    if (typeof version === 'function') { callback = version; version = 0; }
    var filename = this.entryPath(key)+'/'+
                   ((version && version > 0) ? version : 'current')+'.json';
    fs.readFile(filename, 'utf8', function(err, data) {
      if (err) {
        if (typeof err === 'object' && (err.errno === 9 || err.errno === 2))
          err = null;
        return callback && callback(err, null);
      }
      try { data = JSON.parse(data); } catch (e) { err = e; data = null; }
      if (callback) callback(err, data);
    });
  },

  getSync: function(key, version) {
    var filename = this.entryPath(key)+'/'+
                   ((version && version > 0) ? version : 'current')+'.json';
    try {
      return JSON.parse(fs.readFileSync(filename));
    } catch (e) {
      if (typeof e === 'object' && (e.errno === 9 || e.errno === 2))
        return null;
      throw e;
    }
  },
  
  putSync: function(key, document) {
    return this._put(key, document);
  },
  
  put: function(key, document, callback) {
    return this._put(key, document, callback || function(){});
  },
  
  _put: function(key, document, callback) {
    if (typeof document !== 'object')
      throw new TypeError('document must be an object');
    if (typeof document._version !== 'number') document._version = 1;
    else document._version += 1;
    var data = JSON.stringify(document);
    var basename = this.entryPath(key);
    var dstname = basename+'/current.json';
    var lockfile = basename+'/lock';
    var versionname = basename+'/'+document._version+'.json';
    var tempname = versionname+'.temp-'+process.pid+'-'+(new Date).getTime();

    if (callback) {
      // async branch

      var main = function() {
        // write new data
        fs.writeFile(tempname, data, 'utf8', function(err) {
          if (err) return callback(err);

          // lock the entry
          fs.link(tempname, lockfile, function(e) {
            if (e && typeof e === 'object' && e.errno === 17) {
              // someone else already has the lock (we where too slow)
              return fs.unlink(tempname, callback);
            } else if (e) { return callback(e); }
          
            // link version
            fs.link(tempname, versionname, function(e) {
              
              if (e) {
                if (typeof e === 'object' && e.errno === 17) {
                  // someone else wrote this version before we did
                  fs.unlink(tempname, function(e) {
                    fs.unlink(lockfile, function(){ callback(e) });
                  });
                } else {
                  fs.unlink(lockfile, function(){ callback(e) });
                }
                return;
              }
              
              // update current by renaming temporary hardlink
              fs.rename(tempname, dstname, function(e1) {
                fs.unlink(lockfile, function(e2) {
                  callback(e1 || e2, true);
                });
              });
              
            });
            // END link version
          });
          // END lock the entry
        });
        // END write new data
      }
      
      // make directories if we are writing the first version
      if (document._version === 1) {
        this.mkdirs(basename, 0700, function(err) {
          if (err) return callback(err);
          main();
        });
      } else {
        main();
      }

    } else {
      // sync branch

      // make directories if we are writing the first version
      if (document._version === 1)
        this.mkdirsSync(basename, 0700);
      // write new data
      fs.writeFileSync(tempname, data, 'utf8');
      // lock the entry
      try {
        fs.linkSync(tempname, lockfile);
        // link version
        try {
          fs.linkSync(tempname, versionname);
          // update current by renaming temporary hardlink
          fs.renameSync(tempname, dstname);
          return true;
        } catch (e) {
          // someone else wrote this version before we did
          if (typeof e === 'object' && e.errno === 17) {
            fs.unlinkSync(tempname);
            return false;
          }
          throw e;
        } finally {
          fs.unlinkSync(lockfile);
        }
      } catch (e) {
        fs.unlinkSync(tempname);
        // someone else already has the lock (we where too slow)
        if (typeof e === 'object' && e.errno === 17)
          return false;
        throw e;
      }

      return true;
    }
  }
}

exports.FSDocs = FSDocs;
