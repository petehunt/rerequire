var childProcess = require('child_process');
var dedupe = require('authbox-common/dedupe');
var detective = require('detective');
var emptyFunction = require('authbox-common/emptyFunction');
var fs = require('fs');
var path = require('path');
var reactTools = require('react-tools');
var resolve = require('resolve');

function rename(src, dest) {
  // First identify potential dependencies
  var moduleName = path.basename(src).replace(/\.js$/, '');
  src = path.resolve(src);
  dest = path.resolve(dest);

  childProcess.exec('git grep ' + moduleName + ' | cut -f1 -d":"', function(err, stdout, stderr) {
    if (err) {
      console.error(err);
      return;
    }
    console.error(stderr);

    var dependencies = dedupe(stdout.split('\n').filter(emptyFunction.thatReturnsArgument));

    dependencies.forEach(function(dependency) {
      var dependencyPath = path.resolve(dependency);

      if (dependencyPath === src) {
        return;
      }

      console.log('dependency', dependency);
      var dependencySrc = fs.readFileSync(dependencyPath, {encoding: 'utf8'});
      var requires = detective(
        reactTools.transformWithDetails(dependencySrc, {harmony: true, stripTypes: true, es5: true, sourceMap: false}).code
      ).map(function(moduleName) {
        resolve(moduleName, {basedir: path.dirname(dependencyPath)}, function(err, res) {
          if (err) {
            console.error(err);
            return;
          }

          if (res === src) {
            // This dependency depends on the file we're moving. Calculate
            // the new path
            var newRequire = path.relative(path.dirname(dependencyPath), dest).replace(/\.js$/, '');
            if (newRequire.indexOf('.') !== 0) {
              newRequire = './' + newRequire;
            }

            // Now replace the file. Note that since we may have multiple
            // asynchronous writes queued up we want to save this in the
            // src variable. There's a better way to do this with promises
            // but I am lazy today.
            var oldRequire = path.relative(path.dirname(dependencyPath), src).replace(/\.js$/, '');
            if (oldRequire.indexOf('.') !== 0) {
              oldRequire = './' + oldRequire;
            }

            console.log(dependencyPath, newRequire, oldRequire);
            dependencySrc = dependencySrc.replace(oldRequire, newRequire);
            fs.writeFileSync(dependencyPath, dependencySrc, {encoding: 'utf8'});
          }
        });
      });
    });
  });
}

rename(process.argv[2], process.argv[3]);
