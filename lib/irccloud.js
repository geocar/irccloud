const WebSocket = require('ws'), https=require("https")

function IRCCloud(username, password) {
  this.username = username, this.password = password
  this.queue = [];
  this.buffers = {};

  this.on("makebuffer",  function(obj) { this.buffers[obj.name] = obj.cid }.bind(this));
  this.on("open_buffer", function(obj) { this.buffers[obj.name] = obj.cid }.bind(this));

  if(username !== undefined && password !== undefined) this.connect();
}

function get(path, head, then) {
  var req = https.request({
    host:"www.irccloud.com", path:path, method:"GET", headers:head
  }, function (res) {
    var data = ""
    res.on("data", (chunk) => { data += chunk })
    res.on("end", () => { then(null, JSON.parse("" + data)) })
  });
  req.on("error", (e) => { then(e) })
  req.end();
}
function post(path, head, text, then) {
  head['Content-Type']   = 'application/x-www-form-urlencoded';
  head['Content-Length'] = text.length;
  var req = https.request({
    host:"www.irccloud.com", path:path, method:"POST", headers:head
  }, function (res) {
    var data = ""
    res.on("data", (chunk) => { data += chunk })
    res.on("end", () => { then(null, JSON.parse("" + data)) })
  });
  req.on("error", (e) => { then(e) })
  req.write(text);
  req.end();
}

function oops(self, err) {
  delete self.busy;
  self.emit("error", err);

  setTimeout(function() {
    if(self.busy === undefined) reconnect(self)
  }, 60000); // wait
}
function reconnect(self) {
  self.busy = true;

  post("/chat/auth-formtoken", {}, "", function(err, obj) {
    if(err) return oops(self, err);

    post("/chat/login", {"x-auth-formtoken":obj.token}, [
      'email='    + escape(self.username),
      'password=' + escape(self.password),
      'token='    + escape( obj.token)
    ].join('&'), function(err, obj) {
      if(err) return oops(self, err);
      var head = { cookie: "session=" + obj.session }
      var r = 0, ws = new WebSocket("wss://" + obj.websocket_host + obj.websocket_path, {
        origin: "https://api.irccloud.com", headers: head
      });
      ws.on("message",  function(chunk) {
        var text = JSON.parse("" + chunk);
        if(text.type === 'oob_include') {
          get(text.url, head, function(err, obj) {
            if(err) return self.emit("error", err); // but not disconnected
            obj.forEach(function(rec) { self.emit(rec.type, rec) });
          });
        } else {
          var ok=0;
          if(text.type) emit(text.type,text);
          if(text._reqid) emit("reply-" + text._reqid, text);
          if(!ok)self.emit("unhandled", text);

          function emit(a,b) {self.emit(a,b), ok+=self.listenerCount(a)}
        }
      });
      self._flush = function() {
        self.queue.splice(0,self.queue.length).forEach(function(m) {
          ++r; m._reqid = r;
          if(m[1]) self.once("reply-" + r, m[1]); // callback
console.log("->",m[0]);
          ws.send(JSON.stringify(m[0]));
        });
      };
      ws.on("open",  function() {
        ++r; ws.send(JSON.stringify({ cookie: obj.session, _reqid: r, _method: "auth" }));
        if(self.queue.length > 0) self._flush();
      });
      ws.on("close", function () {  oops(self, new Error("Disconnected")) })
      ws.on("error", function (e) { oops(self, e) })
    })
  })
}

IRCCloud.prototype = {
  constructor: IRCCloud,
  authenticate: function(username, password) {
    this.username = username, this.password = password
    if(this.busy === undefined) reconnect(this);
  },
  connect: function() {
    if(this.busy === undefined) reconnect(this);
  },
  _flush: function() {},
  _send: function(method, x, cb) {
    var obj = JSON.parse(JSON.stringify(x));
    obj._method = method;

    this.queue.push([ obj, cb ]);
    this._flush();
  },
  ping: function(who, cb) {
    var t = new Date();
    if(cb === undefined && typeof who === "function") { // ping irccloud
      this._send('heartbeat', {}, function() {
        var d = new Date();
        who(d-t);
      });
    } else {
      var helper = ret.bind(this);
      var countdown = setTimeout(function() {
        this.removeListener('pong', helper);
        cb(Number.POSITIVE_INFINITY);
      }.bind(this), 60000);
      this.on('pong', helper);
      this.say(who, '/ping '+who);

      function ret(e) { var d = new Date(); if(e.msg === who) clearTimeout(countdown), this.removeListener('pong', helper), cb(d-t) }
    }
  },
  say: function(to, line) {
    var pick = this.buffers[to];
    if(pick === undefined) {
      pick = this.buffers[ Object.keys(this.buffers)[0] ];//picksomething
      this._send("say", { msg: '/msg ' + to + ' ' + line, cid: pick, to: to }); //maybe join?
    } else {
      this._send("say", { msg: line, cid: pick, to: to });
    }
  }
};
require("util").inherits(IRCCloud, require('events').EventEmitter);

module.exports = IRCCloud;
