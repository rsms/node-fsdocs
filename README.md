# fsdocs

Simple, [ACID](http://en.wikipedia.org/wiki/ACID) and versioned
file system-based document database for [node.js](http://nodejs.org/).

The idea is that you can use this simple, single-file module for quick hacks
where installing (and possibly deploying) a full-scale "real" database like CouchDB, MySQL, Redis, MongoDB, etc kills your creativity. Since documents and their different versions are stored as regular JSON files, inspecting and manipulating data while developing is really easy and simple (just remove/edit/add files).

Performance is actually pretty good since the kernel will take care of caching
the most frequently read documents in memory. Also, even though this is ACID and
all, a "put" only implies writing a single file. Atomicity and "crashability" is
acquired through a mix of `link(2)` and `rename(2)` operations.

## Example

    var FSDocs = require('fsdocs').FSDocs
    var docs = new FSDocs('./mydocs')

    docs.put('doc1', {title:"Hello"}, function(err, ok) {
      if (err) throw err
      console.log(ok? 'stored ok' : 'conflict: version already exist')
      docs.get('doc1', function(err, document) {
        if (err) throw err
        console.log(document)
      })
    })

## API

### new FSDocs(location) -> [object FSDocs]

A document store based in directory at `location`

#### docs.get(key, [version], [callback(err, document)])

Retrieve a document. If `version` is omitted or less than 1, the most
recent version of the document is returned.

#### docs.getSync(key, [version]) -> document

Synchronous version of `docs.get`

#### docs.put(key, document, [callback(err, storedOk)])

Create or update a document. If `document` does not contain a `_version`
member or its `_version` member is less than 1, the document is
considered as "new" and thus if there's already an existing version an
error will be returned (since the document is effectively version 1). If
there's a conflict when writing the new version, `storedOk` will be a
false value. In this case it's up to the client to proceed (e.g. merge,
discard, retry, etc). `document` must be an object.

#### docs.putSync(key, document) -> storedOk

Synchronous version of `docs.put`


## Implementation

When writing a new document version to the database, fsdocs takes a rather simplistic approach in order to achieve [ACID](http://en.wikipedia.org/wiki/ACID)-ness:

1. The new document is written to a temporary file. If this operation fails, we remove the temporary file and bail with an error.

2. A (hard) link is created at "key/lock" (unique to the document key, not considering version). If this operation fails, another version is already being written which indicates a conflict and thus we bail with an error.

3. A new link is created for the document data "key/version.json". If this operation fails, the document has already been modified (version exists) and thus we bail with an error.

4. Finally the temporary link is renamed to "key/current.json". Because of the success of 2. and 3. we are guaranteed to upgrade the document to its latest version. We also retain atomicity because of the implementation of rename(), making concurrent reads of the "current" version safe.

We remove the "key/lock" file (unless 2. fails) when done with 3 or 4.

Most file systems are in fact highly optimized "key-value stores", in a way.


## Known issues

- If the program crashes during writing a document the lockfile might not get
  cleaned up, thus causing that document to become read-only (since any put
  operation will fail to acquire the lockfile). In cases where there's only one
  process manipulating the documents (or more specifically; only one process
  manipulating a given key), this could be solved by simply adding the PID as
  a suffix of the lockfile.


## MIT license

Copyright (c) 2011 Rasmus Andersson <http://rsms.me/>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
