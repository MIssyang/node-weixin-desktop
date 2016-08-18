// var config = require('../../config').windows.main;
var weixin = require('../../weixin/');
var validator = require('validator');
var fs = require('fs');
var shell = require('electron').shell;
var clipboard = require('electron').clipboard;

var api = require('../../weixin/api');
var settings = require('../../settings');
var wxs = require('../../settings').getObject();
var notifier = require('node-notifier');
var appServer = require('node-weixin-express');
var adapter = require('sails-disk');
var filePath = process.cwd();
var dbConfig = {
  adapters: {
    disk: adapter
  },

  connections: {
    default: {
      adapter: 'disk',
      filePath: filePath
    }
  }
};

var config = require('../../share');
var started = false;
settings.set('jssdk', ['status', 'url', 'prefix'], {});
function messageStorageChecker($scope) {
  var storage = settings.get('storage', true);
  if (fs.existsSync(storage)) {
    try {
      fs.accessSync(storage, fs.constants.W_OK);
      dbConfig.connections.default.filePath = storage + '/';
    } catch (e) {
      $scope.error = true;
      $scope.errorMessage = '当前路径没有写权限！';
      notifier.notify({
        title: 'WebTop初始化失败!',
        message: '当前路径没有写权限！'
      });
      return false;
    }
  } else {
    notifier.notify({
      title: 'WebTop初始化失败!',
      message: '尚未配置消息路径！'
    });
    return false;
  }
  return true;
}

function onConnected($scope, server, template) {
  return function (url) {
    if (!validator.isURL(url)) {
      $scope.template = template;

      $scope.$apply(function () {
        $scope.server = {
          status: '连接失败, 请重新连接！',
          url: url,
          prefix: server.prefix
        };
      });
      console.log('inside url');
      return;
    }
    console.log(url);
    console.log(arguments);
    $scope.$apply(function () {
      $scope.template = template;
      $scope.jssdk = {
        status: '连接成功！',
        url: url,
        prefix: server.prefix
      };
      settings.set('jssdk', ['status', 'url', 'prefix'], $scope.jssdk);
    });
    var qrcode = new QRCode('qrcode-jssdk');
    qrcode.makeCode(url + '/jssdk');
  };
}


function configInit($scope, data) {
  var template = settings.get('template', true);
  var server = settings.get('server');
  var storage = settings.get('storage', true);
  var app = settings.get('app');

  server.prefix = '/weixin';
  settings.set('server', ['host, prefix'], server);
  console.log(server);

  server = settings.get('server');
  $scope.jssdk = settings.get('jssdk');
  $scope.template = template;
  $scope.storage = storage;
  data.weixin.server.prefix = server.prefix;
  data.weixin.app = app;
  data.db = dbConfig;
  data.template = template;
  data.port = server && server.port || data.port;
  data.host = server && server.host || data.host;
}

angular.module('wetop')
  .controller('InterfaceCtrl', function ($scope, $route) {
    console.log('inside home controller');
    $scope.module = 'interface';
    $scope.started = started;

    var path = $route.current.$$route.originalPath;
    switch (path) {
      case '/interface':
        $scope.showBack = false;
        $scope.title = '微信接口测试';
        break;
      case '/interface/auth':
        $scope.showBack = true;
        $scope.url = '#/interface';
        $scope.title = '微信Auth测试';
        break;
      case '/interface/jssdk':
      case '/':

        configInit($scope, config);
        if ($scope.jssdk.url) {
          var qrcode = new QRCode('qrcode-jssdk');
          qrcode.makeCode($scope.jssdk.url + '/jssdk');
        }
        messageStorageChecker($scope);
        $scope.showBack = true;
        $scope.url = '#/interface';
        $scope.title = 'JSSDK微信网页测试';
        break;
      default:

        break;
    }
    $scope.testAuth = function () {
      var app = settings.get('app');
      console.log(app);
      var v = weixin.check('app', app);
      if (!v.code) {
        if (app.id) {
          wxs.get(app.id, 'auth', function (auth) {
            console.log(auth);
            $scope.auth = auth;
          });
        }
        var value = api.auth.tokenize(wxs, v.data);
        value.then(function (res) {
          var status = '成功';
          if (res.errcode) {
            status = '失败！';
            notifier.notify(res);
          } else {
            notifier.notify({
              title: '成功!',
              message: 'accessToken: ' + res.access_token
            });
          }
          $scope.$apply(function () {
            $scope.auth = {
              accessToken: res.access_token
            };
            $scope.status = status;
            if (res.errmsg) {
              $scope.reason = res.errmsg;
            }
          });
        });
      }
    };

    $scope.open = function () {
      console.log('url' + $scope.jssdk.url);
      shell.openExternal($scope.jssdk.url);
    };

    $scope.copy = function () {
      clipboard.writeText($scope.jssdk.url);
      notifier.notify({
        title: 'WeTop',
        message: '复制成功'
      });
    };

    $scope.test = {
      start: function () {
        if (!messageStorageChecker($scope)) {
          return;
        }
        configInit($scope, config);

        $scope.config = config;
        console.log(config);

        if (started) {
          console.log(appServer);
          appServer._tunnel.start(config, onConnected($scope, config.weixin.server, config.template));
          return;
        }

        started = true;
        $scope.started = started;
        appServer.init(config, onConnected($scope, config.weixin.server, config.template));
      }
    };
  });
