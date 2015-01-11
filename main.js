var childProcess = require('child_process');
var detective = require('detective');
var fs = require('fs');
var path = require('path');
var resolve = require('resolve');

function rename(src, dest) {
  // First identify potential dependencies
  var moduleName = path.basename(src).replace(/\.js$/, '');
  src = path.resolve(src);
  dest = path.resolve(dest);

  fs.renameSync(src, dest);

  childProcess.exec('git grep ' + moduleName + ' | cut -f1 -d":"', function(err, stdout, stderr) {
    if (err) {
      console.error(err);
      return;
    }
    console.error(stderr);
    var dependencies = stdout.split('\n');
    dependencies.forEach(function(dependency) {
      var dependencyPath = path.resolve(dependency);
      var dependencySrc = fs.readFileSync(dependencyPath, {encoding: 'utf8'});
      var requires = detective(dependencySrc).map(function(moduleName) {
        resolve(moduleName, {basedir: path.dirname(dependencyPath)}, function(err, res) {
          if (err) {
            console.error(err);
            return;
          }

          if (res === src) {
            // This dependency depends on the file we're moving. Calculate
            // the new path
            var newRequire = path.relative(dependencyPath, dest);
            // Now replace the file. Note that since we may have multiple
            // asynchronous writes queued up we want to save this in the
            // src variable. There's a better way to do this with promises
            // but I am lazy today.
            var oldRequire = path.relative(dependencyPath, src);
            dependencySrc = dependencySrc.replace(oldRequire, newRequire);
            fs.writeFileSync(dependencyPath, dependencySrc, {encoding: 'utf8'});
          }
        });
      });
    });
  });
}

rename(process.argv[1], process.argv[2]);
