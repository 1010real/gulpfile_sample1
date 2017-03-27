var gulp = require("gulp");
var elixir = require('laravel-elixir');
var concat = require("gulp-concat");
var scp = require("gulp-scp2");
var fs = require('fs');
var path = require('path');
var watch = require("gulp-watch");
var notify = require('gulp-notify');

var host = 'xxx.xxx.xxx.xxx';
var envUser = process.env.DEPLOY_USER;
var pochiRoot = process.env.PROJECT_ROOT;
var privateKey = process.env.PROJECT_PRIVATE_KEY;
var passPhrase = "";
// console.log(JSON.stringify(process.env));

var paths = {
// license関連
    license : {
        src       : "./public/licenses",
        dest      : "./public/licenses",
        files     : "/**/*.license",
        mergefile : "index.html",
        header    : "./public/licenses/header",
        footer    : "./public/licenses/footer"
    },
    watch : {
        src : "/client/js/develop/src"
    }
};

// ファイル監視設定
var watchconf = [
    {
        // #1 rsync -av --exclude ".git/" --include "web/" --exclude "*" -e ssh $PROJECT_ROOT/cocos2d-x/ $USER@$HOST:/home/$USER/game-pochi/cocos2d-x
        file : [ pochiRoot + "/cocos2d-x/web/**/*" ],
        option : { base : pochiRoot + "/cocos2d-x/web" },
        task : function(files) {
            scpFile(files, '/home/' + envUser + '/game-pochi/cocos2d-x/web/');
        }
    },
    // {
    //     // #2 rsync -av --exclude ".git/" -e ssh $PROJECT_ROOT/client/Resources $USER@$HOST:/home/$USER/game-pochi/public/
    //     file : [ pochiRoot + "/client/Resources/**/*" ],
    //     option : { base : pochiRoot + "/client/Resources" },
    //     task : function(files) {
    //         scpFile(files, '/home/' + envUser + '/game-pochi/public/Resources/');
    //     }
    // },
    // {
    //     // #3 rsync -av --exclude ".git/" --exclude "ccs" -e ssh $PROJECT_ROOT/client/res $USER@$HOST:/home/$USER/game-pochi/public/
    //     file : [ pochiRoot + "/client/res/**/*", "!" + pochiRoot + "/client/res/ccs/**/*" ],
    //     option : { base : pochiRoot + "/client/res" },
    //     task : function(files) {
    //         scpFile(files, '/home/' + envUser + '/game-pochi/cocos2d-x/web/');
    //     }
    // },
    // {
    //     // #4 rsync -av --exclude ".git/" -e ssh $PROJECT_ROOT/client/res/ccs/ $USER@$HOST:/home/$USER/game-pochi/public/res/ccs
    //     file : [ pochiRoot + "/design/ccs/**/*" ],
    //     option : { base : pochiRoot + "/design/ccs" },
    //     task : function(files) {
    //         scpFile(files, '/home/' + envUser + '/game-pochi/public/res/ccs/');
    //     }
    // },
    {
        // #5 rsync -av --exclude ".git/" -e ssh $PROJECT_ROOT/client/src $USER@$HOST:/home/$USER/game-pochi/public/
        file : [ pochiRoot + paths.watch.src + "/**/*" ],
        option : { base : pochiRoot + paths.watch.src },
        task : function(files) {
            scpFile(files, '/home/' + envUser + '/game-pochi/public/src/');
        }
    },
    // {
    //     // #6 rsync -av --exclude ".git/" -e ssh $PROJECT_ROOT/client/admin $USER@$HOST:/home/$USER/game-pochi/public/
    //     file : [ pochiRoot + "/client/admin/**/*" ],
    //     option : { base : pochiRoot + "/client/admin" },
    //     task : function(files) {
    //         scpFile(files, '/home/' + envUser + '/game-pochi/public/admin/');
    //     }
    // },
    {
        // #7 rsync -av --exclude ".git/" -e ssh $PROJECT_ROOT/client/web $USER@$HOST:/home/$USER/game-pochi/public/
        file : [ pochiRoot + "/client/web/**/*" ],
        option : { base : pochiRoot + "/client/web" },
        task : function(files) {
            scpFile(files, '/home/' + envUser + '/game-pochi/public/web/');
        }
    },
    {
        // #8 rsync -av --include "*.js" --include "*.css" --include "*.json" --include "*.html" --include "*.php" --exclude "*" -e ssh $PROJECT_ROOT/client/ $USER@$HOST:/home/$USER/game-pochi/public/
        file : [ pochiRoot + "/client/**/*.+(js|css|json|html|php)", "!" + pochiRoot + paths.watch.src + "/**/*" ],
        option : { base : pochiRoot + "/client" },
        task : function(files) {
            scpFile(files, '/home/' + envUser + '/game-pochi/public/');
        }
    },
];

gulp.task("watch", function() {
    process.stdin.setEncoding('utf8');
    process.stdin.once('readable', function(){
        console.log('Enter passphrase if necessary ...');
    });
    process.stdin.once('data', function(chunk){
        passPhrase = passPhrase + chunk.replace("\n", "");
        console.log('OK. Start watching ...');
        // watch開始
        for(var i=0;i<watchconf.length;i++) {
            watch(watchconf[i].file, watchconf[i].option, watchconf[i].task);
        }
    });
});

/*
 |--------------------------------------------------------------------------
 | Elixir Asset Management
 |--------------------------------------------------------------------------
 |
 | Elixir provides a clean, fluent API for defining some basic Gulp tasks
 | for your Laravel application. By default, we are compiling the Sass
 | file for our application, as well as publishing vendor resources.
 |
 */

gulp.task("run_elixir", function(){
    elixir(function(mix) {
        mix.sass('app.scss')
            .browserify('app.js')
            .version(['css/app.css', 'js/app.js']);
    });
});

gulp.task("create_license", function(){
    gulp.src(paths.license.src + paths.license.files)
        .pipe(concat(paths.license.mergefile))
        .pipe(addHeaderFooter(paths.license))
        .pipe(gulp.dest(paths.license.dest));
});

gulp.task("default", ["run_elixir", "create_license"]);

// destを書き換えたscp設定を生成
function createScpConfig(destTarget) {
    var config = {
        host : host,
        username : envUser,
        privateKey : fs.readFileSync(privateKey),
        dest : destTarget,
        readyTimeout : 60000,
        keepaliveCountMax : 10,
        watch: function(client) {
          client.on('write', function(o) {
            var date = new Date();
            console.log('%s: uploaded - %s', new Date().toString(), o.destination);
          });
        }
    };
    if (passPhrase.length > 0) {
        config.passphrase = passPhrase;
    }
    return config;
}

// 指定したファイルをscp
function scpFile(glob, dest) {
    var destRelative = path.dirname(path.normalize(dest + path.relative(glob.base, glob.history[0])));
    glob.history.push("!**.git**"); // .gitは無視
    gulp.src(glob.history, { cwd:glob.base } )
        .pipe(scp(createScpConfig(destRelative)))
        .on('error', notify.onError(function(err) {
            // console.log(JSON.stringify(err));
            return err.level + ' - ' + err.message;
        }));
}

// ファイルの前後に指定したファイルの内容を追加するプラグイン
// @author okamoto-masao
// ex: .pipe(addHeaderFooter({ header : './header_file_path', footer: './footer_file_path' }))
function addHeaderFooter(opt) {
    var through = require('through2');
    var gutil = require('gulp-util');
    var PluginError = gutil.PluginError;
    var fs = require('fs');
    var header = null;
    var footer = null;

    opt = opt || {};

    if (opt.header) {
        if (typeof opt.header == 'string') {
            header = fs.readFileSync(opt.header);
        } else {
            throw new PluginError('addHeaderFooter', 'Missing path in opt.header options for addHeaderFooter');
        }
    }

    if (opt.footer) {
        if (typeof opt.footer == 'string') {
            footer = fs.readFileSync(opt.footer);
        } else {
            throw new PluginError('addHeaderFooter', 'Missing path in opt.footer options for addHeaderFooter');
        }
    }

    function bufferContents(chunk, enc, callback) {
        // ignore empty files
        if (chunk.isNull()) {
          callback();
          return;
        }

        // we don't do streams
        if (chunk.isStream()) {
          this.emit('error', new gutil.PluginError('addHeaderFooter',  'Streaming not supported'));
          callback();
          return;
        }

        if (header) {
            chunk.contents = Buffer.concat([header, chunk.contents], header.length + chunk.contents.length);
        }

        if (footer) {
            chunk.contents = Buffer.concat([chunk.contents, footer], footer.length + chunk.contents.length);
        }

        this.push(chunk);

        callback(null, chunk);
    }

    return through.obj(bufferContents);
}
