var FSDocs = require('./fsdocs').FSDocs;
var docs = new FSDocs(__dirname+'/mydocs');

// synchronous API
console.log(docs.putSync('doc1', {title:'internet', age:35.5}))
console.log(docs.getSync('doc1'))

// asynchronous API
docs.put('doc2', {title:'internets', age:35.5}, function(err, ok) {
  if (err) return console.error('error: '+(err.stack || err));
  console.log('stored? '+(ok ? 'true':'false'))
  docs.get('doc2', function(err, document) {
    if (err) throw err;
    console.log(document);
  });
})

/*
var t, i, iterations = 1000;

t = new Date; i = iterations;
while (i--)
  docs.putSync('doc-'+i, {title:'internet', age:23.9, _version: 1});
t = (new Date)-t;
console.log('write performance: %d ms total, %d ms/op, %d ops/second',
            t, t/iterations, Math.round(1000/(t/iterations)))

t = new Date; i = iterations;
while (i--) db.getSync('doc-'+i)
i = iterations;
while (i--) db.getSync('doc-'+i)
i = iterations;
while (i--) db.getSync('doc-'+i)
t = (new Date)-t;
console.log('read performance: %d ms total, %d ms/op, %d ops/second',
            t, t/iterations, Math.round(1000/(t/iterations)))
*/
