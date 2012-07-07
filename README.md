# fs.notify

Node.js file change notification that doesn't suck hairy monkey balls.

```js
var Notify = require('fs.notify');

var files = [
  '/path/to/file',
  '/file/i/want/to/watch'
];

var notifications = new Notify(files);
notifications.on('change', function (file) {
  console.log('file changed');
});

// kill everything
notifications.close();
```

## LICENSE (MIT)
