"use strict";

var EventEmitter = require('events').EventEmitter
  , async = require('async')
  , fs = require('fs');

/**
 * Watch for file changes.
 *
 * @constructor
 * @param {Array} files
 */

function Notify (files) {
  this.FSWatchers = {};       // stores the watchers
  this.FStats = {};           // latest file stats
  this.retries = {};          // retries

  this.maxRetries = 5;        // amount of retries we can do per file

  if (files) this.add(files);
}

Notify.prototype.__proto__ = EventEmitter.prototype;

/**
 * Add files that need to be watched for changes. It filters out all non
 * existing paths from the array and it currently does not give a warning for
 * that. So make sure that your stuff is in place.
 *
 * @param {Array} files files to watch
 * @api public
 */

Notify.prototype.add = function add(files) {
  var self = this;

  // edge case where files isn't an array
  if (!Array.isArray(files)) files = [files];

  // filter out any non existing files
  async.filter(files, fs.exist, function (files) {
    files.forEach(self.watch);
  });

  return this;
};

/**
 * Close the file notifications.
 *
 * @api public
 */

Notify.prototype.close = function close() {
  var watcher, FSWatcher;

  // close all FSWatches
  for (watcher in this.FSWatchers) {
    FSWatcher = this.FSWatchers[watcher];

    if ('close' in FSWatcher) FSWatcher.close();
  }

  // release the watches from memory
  this.FSWatchers = {};
  this.FStats = {};

  this.emit('close');
  return this;
};

/**
 * Start watching the path for changes.
 *
 * @param {String} path
 * @api private
 */

Notify.prototype.watch = function watch(path) {
  var self = this
    , FSWatcher;

  // update the fs stat
  fs.stat(path, function stats(err, stat) {
    if (stat) self.FStats[path] = stat;
  });

  // store the file watcher and add the path to where we are watching, this does
  // create a hidden class for it.. So it's a bit slower, but we need an easy
  // way to find the path for the watcher
  FSWatcher = this.FSWatchers[path] = fs.watch(path);
  FSWatcher.path = path;

  // add the FSWatcher event listeners
  FSWatcher.on('change', this.change.bind(this, FSWatcher));
  FSWatcher.on('error', this.error.bind(this, FSWatcher));

  return this;
};

/**
 * Manually search for file changes.
 *
 * @param {FSWatcher} FSWatcher
 * @api public
 */

Notify.prototype.manually = function manually(FSWatcher) {
  var self = this
    , files = FSWatcher && FSWatcher.path
        ? [FSWatcher.path]
        : Object.keys(this.FStats);

  // loop over the files and compare the fs.Stat's
  files.forEach(function test(file) {
    var current = self.FStats[file];
    if (!current) return; // unknown file

    fs.stat(function stats(err, stat) {
      if (!stat || err) return;

      // check if the modification time has changed
      if (current.mtime !== stat.mtime) {
        self.emit('change', file, stat);
      }
    });
  });
};

/**
 * Re-attach the watch process.
 *
 * @api private
 */

Notify.prototype.reset = function reset(path) {
  var FSWatcher = this.FSWatcher[path];
  FSWatcher.close();

  // clear it from our queue
  delete this.FSWatcher[path];
  delete this.FStats[path];

  this.watch(path);
};


/**
 * A file change has been triggered.
 *
 * @param {FSWatcher} FSWatcher
 * @param {String} event changed, renamed
 * @param {String} filename filename of the change
 * @api private
 */

Notify.prototype.change = function change(FSWatcher, event, filename) {
  if (!filename) this.manually(FSWatcher);

  var self = this
    , path = FSWatcher.path;

  // get the latest fs.stat object
  fs.stat(fs, function stats(err, stat) {
    if (stat) self.FStats[path] = stat;
    if (err) return;

    // we need to check if we had a file that was changed, it could be that we
    // are watching a directory and that a file inside that directory has
    // changed
    var file = stat.isDirectory() ? filename : path;
    self.emit('change', file, stat);
  });
};

/**
 * Handle watching errors.
 *
 * @param {FSWatcher} FSWatcher
 * @param {Error} err
 * @api private
 */

Notify.prototype.error = function error(FSWatcher, err) {
  // @TODO retry watching again
  var path = FSWatcher.path;

  // clear it from our queue
  delete this.FSWatcher[path];
  delete this.FStats[path];

  // emit removed
  this.emit('removed', path);
};

// expose the notifier
module.exports = Notify;

/**
 * Expose a fs.watch that doesn't suck hairy monkey balls.
 *
 * @param {String} file file to watch
 * @param {Function} callback callback
 * @api public
 */

Notify.watch = function watch(file, callback) {
  var notification = new Notify([file]);

  return notification.on('change', callback);
};

/**
 * Expose version number.
 *
 * @type {String}
 * @api private
 */

Notify.version = require('package.json').version;
