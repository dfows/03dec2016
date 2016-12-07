var port = process.env.PORT || 8888;

var GH_CLIENT_ID = process.env.GH_CLIENT_ID;
var GH_CLIENT_SECRET = process.env.GH_CLIENT_SECRET;

var oauth = require('oauth').OAuth2;
var OAuth2 = new oauth(GH_CLIENT_ID, GH_CLIENT_SECRET, "https://github.com/", "login/oauth/authorize", "login/oauth/access_token");

var express = require('express');
var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

var methodOverride = require('method-override');
app.use(methodOverride(function(req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    var method = req.body._method;
    delete req.body._method;
    return method;
  }
}));

var GitHubApi = require('github');
var gh = new GitHubApi({
  //debug: true
});

var session = require('client-sessions');
app.use(session({
  cookieName: 'session',
  secret: 'wt?!?!?!??!?!',
  duration: 1800000,
  activeDuration: 300000 // DONT UNDERSTAND
}));

app.get('/login', function(req, res) {
  res.writeHead(303, {
    Location: OAuth2.getAuthorizeUrl({
      redirect_uri: 'http://localhost:8888/login/cb',
      scope: "user, repo, gist"
    })
  });
  res.end();
});

app.get('/login/cb', function(req, res) {
  var code = req.query.code;
  OAuth2.getOAuthAccessToken(code, {}, function(err, access_token, refresh_token) {
    if (err) { console.log(err); }
    var accessToken = access_token;
    gh.authenticate({
      type: "oauth",
      token: accessToken
    });
    gh.users.get({}, function(err, result) {
      req.session.user = {
        username: result.login,
        token: accessToken
      };
      res.redirect('/showAllRepos');
    });
  });
});

app.get('/showAllRepos', function(req, res) {
  if (!authed(req)) {
    return res.redirect('/login');
  }
  var user = req.session.user.username;
  gh.repos.getForUser({
    username: user // my question is how do i use my token here
  }, function(err, result) {
    var uh = result.map(function(repo) {
      var repoName = repo.name;
      return '<p><a href="/viewRepo/' + repoName + '">' + repoName + '</a></p>';
    }).join('');
    var wut = '<html>' +
      '<head>' +
        '<meta http-equiv="Content-Type" content="text/html" charset=UTF-8 />' +
        '<title>show all repos</title>' +
      '</head>' +
      '<body>' +
        uh +
        '<form action="/logout" method="post">' +
          '<input type="submit" value="log out" />' +
        '</form>' +
      '</body>' +
    '</html>';
    res.send(wut);
  });
});

app.get('/viewRepo/:repo', function(req, res) {
  if (!authed(req)) {
    return res.redirect('/login');
  }
  var repoName = req.params.repo;
  var wut = '<html>' +
    '<head>' +
      '<meta http-equiv="Content-Type" content="text/html" charset=UTF-8 />' +
      '<title>show all repos</title>' +
    '</head>' +
    '<body>' +
      '<form action="/changeName/' + repoName + '" method="post">' +
        '<input type="hidden" name="_method" value="patch" />' +
        '<input type="hidden" name="oldName" value="' + repoName + '" />' +
        '<p>Old name: ' + repoName + '</p>' +
        '<p>New name: <input type="text" name="newName" /></p>' +
        '<input type="submit" value="change name" />' +
      '</form>' +
    '</body>' +
  '</html>';
  res.send(wut);
});

app.patch('/changeName/:repo', function(req, res) {
  if (!authed(req)) {
    return res.redirect('/login');
  }
  var user = req.session.user.username;
  var oldName = req.params.repo;
  var newName = req.body.newName;
  // hold up should this be a post request or a patch request cuz im not actually patching anything. i'm patching in my request to githubapi. but not. this . ok. idfk. idfc.
  gh.authenticate({
    type: "oauth",
    token: req.session.user.token
  });
  gh.repos.edit({
    owner: user,
    repo: oldName,
    name: newName
  }, function(err, result) {
    if (err) {
      console.log(err);
      res.send(err.message);
    } else {
      res.redirect('/showAllRepos');
    }
  });
});

app.post('/logout', function(req, res) {
  req.session.reset();
  res.redirect('/');
});

app.get('/', function(req, res) {
  if (!authed(req)) {
    return res.send('<a href="/login">log in</a>');
  } else {
    return res.redirect('/showAllRepos');
  }
});

function authed(req) {
  return !!req.session && !!req.session.user;
}

app.listen(port);
