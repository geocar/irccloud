This is a single-user IRC server that connects to your [IRCCloud](https://irccloud.com/) account.

It's not a full implementation of IRC, but [erc](https://www.emacswiki.org/emacs/ERC) can connect.

####Pre-Flight

    npm install

####Running

    port=6667 node server.js

####Connecting

The IRC server recognises your IRCCloud username and password from the IRC "full name" and IRC password fields.

Here is what I use for ERC:

     (erc :server "localhost"
          :nick "nickname"
          :password "irccloud password"
          :full-name "irccloud username")


