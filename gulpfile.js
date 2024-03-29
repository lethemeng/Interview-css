/*!
 * gulpfile.js -https://github.com/Ikarows
 * Version - 1.0.0
 * author: Cosplay
 * time: 2018-04-11
 * Copyright (c) 2018 Daniel Eden
 */

const config = require('./config'),
    fs = require('fs');

$ = require('gulp-load-plugins')()

const path = require('path')
const gulp = require('gulp')
const pngquant = require('imagemin-pngquant')
const del = require('del')
const runSequence = require('run-sequence')
const px2rem = require('gulp-px2rem-plugin')
const colors = require('colors');
colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    info: 'green',
    data: 'grey',
    cyan: 'cyan',
    warn: 'yellow',
    debug: 'blue',
    error: 'red'
});

// webpack
const webpack = require('webpack')
const webpackStream = require('webpack-stream')
const webpackConfig = require('./webpack.config.js')

// server
const browserSync = require('browser-sync').create()
const reload = browserSync.reload

// NODE_ENV
const env = process.env.NODE_ENV || 'development'
const condition = env === 'production'

function respath(dir) {
    return path.join(__dirname, './', dir)
}

function onError(error) {
    const title = error.plugin + ' ' + error.name
    const msg = error.message
    const errContent = msg.replace(/\n/g, '\\A ')

    $.notify.onError({
        title: title,
        message: errContent,
        sound: true
    })(error)

    this.emit('end')
}

function cbTask(task) {
    return new Promise((resolve, reject) => {
        del(respath('dist'))
            .then(paths => {
                console.log(colors.info(`
      -----------------------------
        Clean tasks are completed
      -----------------------------`))
                $.sequence(task, () => {
                    console.log(colors.info(`
        -----------------------------
          All tasks are completed
        -----------------------------`))
                    resolve('completed')
                })
            })
    })
}

gulp.task('html', () => {
    return gulp.src(config.dev.html)
        .pipe($.plumber(onError))
        /*.pipe($.fileInclude({
          prefix: '@@',
          basepath: respath('src/include/')
        }))*/
        .pipe($.ejs({})) //编译ejs
        .pipe($.useref()) //前台加相关代码后可以合并css和js成统一文件

        //格式化(美化) html
        .pipe($.htmlBeautify({
            indent_size: 4,
            indent_char: ' ',
            // 这里是关键，可以让一个标签独占一行
            unformatted: true,
            // 默认情况下，body | head 标签前会有一行空格
            extra_liners: []
        }))

        //压缩html
        .pipe($.if(condition, $.htmlmin({
            removeComments: true,
            collapseWhitespace: true,
            minifyJS: true,
            minifyCSS: true
        })))

        .pipe(gulp.dest(config.build.html))
})

/* 版本号-己去除 */
gulp.task('revHtmlCss', function () {
    return gulp.src([config.revCssJson, config.revCss, config.revCss] /*[config.revCssJson, config.dev.allhtml]*/)
        .pipe($.revCollector({
            replaceReved: true
        }))
        .pipe(gulp.dest(config.build.html)) //html更换css,js文件版本，更改完成之后保存的地址
})

gulp.task('less', () => {
    return gulp.src(config.dev.less)
        .pipe($.plumber(onError))
        .pipe($.if(config.px3rem, $.px3rem({
            baseDpr: 1,             // base device pixel ratio (default: 2)
            threeVersion: true,    // whether to generate @1x, @2x and @3x version (default: false)
            remVersion: true,       // whether to generate rem version (default: true)
            remUnit: 50,            // rem unit value (default: 75)
            remPrecision: 4         // rem precision (default: 6)
        })))
        .pipe($.less())
        .pipe($.if(condition, $.cleanCss({
            debug: true
        })))
        .pipe($.postcss('./.postcssrc.js'))
        .pipe(gulp.dest(config.build.styles))
})

gulp.task('sass', () => {
    return gulp.src(config.dev.sass)
        .pipe($.plumber(onError))
        .pipe($.if(config.px3rem, $.px3rem({
            baseDpr: 1,             // base device pixel ratio (default: 2)
            threeVersion: true,    // whether to generate @1x, @2x and @3x version (default: false)
            remVersion: true,       // whether to generate rem version (default: true)
            remUnit: 50,            // rem unit value (default: 75)
            remPrecision: 4         // rem precision (default: 6)
        })))
        .pipe($.sass())
        .pipe($.if(condition, $.cleanCss({
            debug: true
        })))
        .pipe($.postcss('./.postcssrc.js'))
        .pipe(gulp.dest(config.build.styles))
})

gulp.task('styles', () => {
    gulp.start(['less', 'sass'])
})

gulp.task('images', () => {
    return gulp.src(config.dev.images)
        .pipe($.plumber(onError))
        .pipe($.cache($.imagemin({
            progressive: true, // 无损压缩JPG图片
            svgoPlugins: [{
                removeViewBox: false
            }], // 不移除svg的viewbox属性
            use: [pngquant()] // 使用pngquant插件进行深度压缩
        })))
        .pipe(gulp.dest(config.build.images))
})

gulp.task('sprite', () => {
    return gulp.src(config.dev.sprite)
        .pipe($.plumber(onError))
        .pipe($.spritesmith({
            imgName: 'sprite.png',
            cssName: config.build.sprite + 'sprite.css',
            padding: 5,
            //algorithm:'binary-tree'
        }))
        .pipe(gulp.dest(config.build.images))
})

gulp.task('eslint', () => {
    return gulp.src(config.dev.script)
        .pipe($.plumber(onError))
        .pipe($.if(condition, $.stripDebug()))
        .pipe($.eslint({
            configFle: './.eslintrc'
        }))
        .pipe($.eslint.format())
        .pipe($.eslint.failAfterError());
})

const useEslint = config.useEslint ? ['eslint'] : [];
gulp.task('script', useEslint, () => {
    gulp.src(config.dev.script)
        .pipe($.if(config.useWebpack, webpackStream(webpackConfig, webpack)))
        .pipe($.plumber(onError))
        .pipe($.babel({
            presets: ['env']
        }))
        .pipe($.if(condition, $.uglify()))
        .pipe(gulp.dest(config.build.script))
})

gulp.task('static', () => {
    return gulp.src(config.dev.static)
        .pipe(gulp.dest(config.build.static))
})

gulp.task('clean', () => {
    del('./dist').then(paths => {
        console.log('Deleted files and folders:\n', paths.join('\n'));
    });
})

gulp.task('watch', () => {
    $.watch(config.dev.allhtml, () => {
        gulp.start(['html'])
    }).on('change', reload)

    $.watch(config.dev.script, () => {
        gulp.start(['script'])
    }).on('change', reload)

    $.watch(config.dev.images, () => {
        gulp.start(['images'])
    }).on('change', reload)

    $.watch(config.dev.sprite, () => {
        gulp.start(['sprite'])
    }).on('change', reload)

    $.watch(config.dev.static, () => {
        gulp.start(['static'])
    }).on('change', reload)

    $.watch([config.dev.less, config.dev.sass], () => {
        gulp.start(['less', 'sass'])
    }).on('change', reload)

    /* 实时同步删除文件 */
    $.watch([config._src, config._static], {
        ignoreInitial: false
    })
        .on('unlink', function (file) {

            //删除文件
            var distFileSrc = './dist/' + path.relative(config._src, file); //计算相对路径
            var distFileStatic = './dist/static/' + path.relative(config._static, file); //计算相对路径
            fs.existsSync(distFileSrc) && del(distFileSrc)
            fs.existsSync(distFileStatic) && del(distFileStatic)
        });
})

gulp.task('zip', () => {
    return gulp.src(config.zip.path)
        .pipe($.plumber(onError))
        .pipe($.zip(config.zip.name))
        .pipe(gulp.dest(config.zip.dest))
})

gulp.task('server', () => {
    const task = ['html', 'styles', 'script', 'sprite', 'images', 'static']
    cbTask(task).then(() => {
        browserSync.init(config.server)
        console.log(colors.cyan('  Server complete.\n'))
        gulp.start('watch')
    })
})


gulp.task('build', () => {
    const task = ['html', 'styles', 'script', 'sprite', 'images', 'static']
    cbTask(task).then(() => {
        console.log(colors.cyan('  Build complete.\n'))

        if (config.autoUploadSftp) {
            gulp.start('upload', () => {
                console.log(colors.info(`
                -----------------------------
                      代码自动部署完成
                -----------------------------`))
            })
        }

        if (config.productionZip) {
            gulp.start('zip', () => {
                console.log(colors.cyan('  Zip complete.\n'))
            })
        }
    })
})

/**
 * 自动部署到服务器
 */
gulp.task('upload', function (callback) {
    console.log(colors.info(`
        -----------------------------
              正在部署到服务器上
        -----------------------------`));
    gulp.src('.' + config.sftp.publicPath + '**')
        .pipe($.sftp(Object.assign(config.sftp.devDist, {
            callback
        })));
});

gulp.task('default', () => {
    console.log(colors.info(
        `
  Build Setup
    开发环境： npm run dev
    生产环境： npm run build
    部署代码： npm run upload
    打包压缩： npm run zip
    编译页面： gulp html
    编译脚本： gulp script
    编译样式： gulp styles
    语法检测： gulp eslint
    压缩图片： gulp images
    合雪碧图： gulp sprite
    `
    ))
})
