const byline = require('byline'), IRCCloud = require("./lib/irccloud")

function flat(x) { return x.reduce((a,b)=>{return a.concat(b)}, []) }

function text(x) {return (""+x).replace(/[\r\n]/g, ""); }
function connected(sock) {
  var h = {}, o = {}, irc = new IRCCloud(), channels = {}, skip = {}
  irc.on("buffer_msg", function(obj) {
    var key = obj.chan + ',' + obj.msg;
    if(skip[key]) { delete skip[key]; return; }
    sock.write(':' + obj.from + " PRIVMSG " + obj.chan + " :" + text(obj.msg) + "\n");
  });
  irc.on("error", function(obj) {
    sock.write('ERROR :server ' + text(obj.msg) + "\n");
  });
  irc.on("quit", function(obj) {
    sock.write(':' + obj.nick + " QUIT :" + text(obj.msg) + "\n");
  });
  irc.on("stat_user", function() { });
  irc.on("heartbeat_echo", function() { }); // not interesting
  irc.on("idle", function() { }); // not interesting
  irc.on("makeserver", function(obj) {
    skip = {}
    o.nickname = obj.nick;
    o.userinfo = o.nickname + '!' + obj.usermask;
    sock.write(':server 001 ' + o.nickname + ' :Welcome to the Internet Relay Network ' + o.userinfo + "\n");
    sock.write(':server 002 ' + o.nickname + " :Your host is server, running irccloud\n");
    sock.write(':server 003 ' + o.nickname + " :This server was created Mon Oct 13 2003 at 15:56:53 EEST\n");
    sock.write(':server 004 ' + o.nickname + " :irccloud 0 iowghraAsORTVSxNCWqBzvdHtGpI lvhopsmntikrRcaqOALQbSeIKVfMCuzNTGjZ\n");
    sock.write(':server 375 ' + o.nickname + " :-\n");
    sock.write(':server 372 ' + o.nickname + " :-\n");
    sock.write(':server 376 ' + o.nickname + " :End of /MOTD command.\n");
    sock.write(':server :' + obj.nick + ' MODE ' + obj.nick + ":+i\n");
  });

  irc.on("channel_init", function(obj) {
    sock.write(':' + o.userinfo + ' JOIN :' + obj.chan + "\n");
    sock.write(':server 353 ' + o.userinfo + ' @ ' + obj.chan + ' :' + obj.members.map((m) => {
      return (m.mode.match(/\+[^-]*o/i) ? '@' : '') +(m.mode.match(/\+[^-]*v/i) ? '+' : '') + text(m.nick);
    }).join(' ') + "\n");
    channels[ obj.chan ] = obj;
    sock.write(':server 366 ' + o.nickname + ' ' + obj.chan + ' :End of NAMES list.' + "\n");
  });
  irc.on("unhandled", function(e) {
    console.error(e);
  });

  h.PASS = (x) => { o.password = x }
  h.NICK = (x) => { o.nickname = x }
  h.PING = (x) => { sock.write(":server PONG " + text(x) + "\n") };
  h.USER = (_1,_2,_3,x) => { 
    x = x.replace(/^:/,"");
    irc.authenticate(o.username = x, o.password)
  }
  h.MODE = (x, y) => {
    if(x.match(/^#/)) {
      var m = channels[x];
      sock.write(':server 324 ' + o.nickname + ' ' + x + ' ' + (m.mode ? m.mode : "+") + "\n");
      if(m && m.topic) {
        sock.write(':server 332 ' + o.nickname + ' ' + x + ' :' + m.topic.text + "\n");
      } else {
        sock.write(':server 331 ' + o.nickname + ' ' + x + " :No topic is set\n");
      }
      sock.write(':server 329 ' + o.nickname + ' ' + x + ' ' + (m.timestamp^0) + "\n");
    } else {
      sock.write(':server 221 ' + o.nickname + ' ' + x + " +\n");
    }
  };
  h.PRIVMSG = function() {
    var t = arguments[0];
    var x = [].slice.call(arguments, 1).join(' ').replace(/^:/, "");
    skip[t+','+x]=1;
    irc.say(t,x);
  };

  byline.createStream(sock).on("data", (line) => {
    var i, x = line.toString("utf8").split(" "), n = x[0].toUpperCase(), f = h[n];
    if(f) f.apply(null, x.slice(1)); else console.log("nyi:",x);
  })
}



if (module.id === ".") {
  if(process.env.port) {
    require("net").createServer(connected).listen(process.env.port)
  } else {
    connected(process.stdin)
  }
}
 
