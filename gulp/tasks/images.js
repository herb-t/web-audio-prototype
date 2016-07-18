/**
 * Minify PNG, JPEG, GIF and SVG images.
 * @tasks/images
 */

'use strict';

var imagemin = require('gulp-imagemin');

/**
 * @param gulp - function
 * @param bs - Browser sync instance
 * @param options - object
 * options.src : Directory of images to optimize.
 * options.dist : Output directory.
 * @returns {Function}
 */
module.exports = function( gulp, bs, options ) {

  return function() {

    return gulp.src( options.src )
      .pipe(imagemin())
      .pipe(gulp.dest( options.dist ))
      .pipe(bs.stream());

  };

};
