 // index.js

// ---SETUP---
// requests
const request = require('request');
const axios = require('axios');

// api details
const api = {
  defaultGroup: "All Machines",
  testPath: "/openapidocument.axd",
  addEventToSessions: "/Services/PageService.ashx/event-to-sessions",
  guestSessionInfo: "/Services/PageService.ashx/guest-session-info",
  createSession: "/Services/PageService.ashx/CreateSession"
}


// ---PUBLIC ITEMS---
// the object
function Queue() {
  // connection details
  this.conn = {
    auth: {}
  };
}

// test initial connection to SC API and cache details
Queue.prototype.connect = function (urlBase, user, key, refresh=7200 ) {
  return new Promise((resolve, reject)=>{

    // don't loose yourself
    const self = this;

    try{

      // save the url base
      if(!urlBase){
        reject("connect() expects urlBase with call")
      } else if (urlBase.slice(-1) == "/"){
        urlBase = urlBase.slice(0,-1);
      }
      self.conn.urlBase = urlBase;

      // build api-up test path
      self.conn.apiUpTestPath = `${self.conn.urlBase}${api.testPath}`

      // save the user
      if (user){
        self.conn.auth.username = user;
      } else {
        reject("connect() expects user with call")
      }

      // save the key
      if (key){
        self.conn.auth.password = key;
      } else {
        reject("connect() expects key with call")
      }

      // fetch our anti-forgery-token
      let requestOpts = {
        auth: self.conn.auth,
        method: "GET",
        url: self.conn.urlBase,
        withCredentials: true
      }
      axios(requestOpts)
        .then(res => {

          // dig the anti forgery token and cookie out with your fingernails
          let r = /"antiForgeryToken":"[\/\+\=A-z0-9]+"/;
          self.antiForgery = {
            token: res.data.match(r)[0].split(":")[1].replace(/"/g, ''),
            cookie: res.headers['set-cookie'][0].split("; ")
          }
          // plan to rework all of this at some point
          self.antiForgery.cookie.forEach(deet => {
            let parts = deet.split("=");
            if (parts[0] == "expires"){
              let expire = Date.parse(parts[1]);
              let refresTimer = Date.now() + (refresh * 1000);
              if (expire < refresTimer){
                self.antiForgery.expire = expire;
              } else {
                self.antiForgery.expire = refresTimer;
              }
            }
          });
          // set the headers
          self.headers = {
            'X-Anti-Forgery-Token': self.antiForgery.token,
            'Cookie': self.antiForgery.cookie[0]
          }
        })
        .then(() => {
          // test connectivity to the api
          let requestOpts = {
            auth: self.conn.auth,
            method: "GET",
            url: self.conn.apiUpTestPath
          }
          return axios(requestOpts);
        })
        .then(res => {
          // note when we did this
          self.conn.lastConn = Date.now();

          // set connected to true
          self.conn.state = true;

          // resolve
          resolve(`${res.data.info.title}:${res.data.info.version}`);          

        })
        .catch(err => reject(err))

    } catch(err) {
      reject(err);
    }
  });
}


// Queue a command for a given host
Queue.prototype.command = function (sessions, command, opts = {group: api.defaultGroup}) {
  return new Promise((resolve, reject)=>{

    // don't loose yourself
    const self = this;

    try{

      // ensure that the api connect() is complete
      if (!self.conn.hasOwnProperty('state') || !self.conn.state){
        setTimeout(function(){
          // retry
          self.command(sessions, command, opts)
            .then(result => resolve(result));
        }, 500);
      } else {

        // we want to pass an array of sessionIDs, even if we only got one
        if (Array.isArray(sessions)){
          sessions = sessions;
        } else {
          sessions = [sessions];
        }

        // build the url
        let url = `${self.conn.urlBase}${api.addEventToSessions}`;
        // build the payload
        let payload = [opts.group, sessions, 44, command]


        // POST the reqeust
        let requestOpts = {
          auth: self.conn.auth,
          url: url,
          method: "POST",
          headers: self.headers,
          data: payload
        }
        axios(requestOpts)
        .then(res => {
          resolve({status: "success", message: res.data});
        })
        .catch(err => reject(err));

      }
    } catch(err) {
      reject(err);
    }
  });
}

// Create a session
Queue.prototype.createSession = function (type, name, accessCode = false) {
  return new Promise((resolve, reject)=>{

    // don't loose yourself
    const self = this;

    try{

      // ensure that the api connect() is complete
      if (!self.conn.hasOwnProperty('state') || !self.conn.state){
        setTimeout(function(){
          // retry
          self.createSession(type, name)
            .then(result => resolve(result));
        }, 500);
      } else {

        // build the request body
        let deets = [];
        // what type of support session are we looking for?
        if(type == "support"){
          deets.push(0);
        } else {
          // we really only do support sessions
          deets.push(0);
        }
        // the name
        deets.push(name);
        // this is a coded session
        deets.push(false);
        // we need an access code
        if(!accessCode){
          accessCode = Math.floor(Math.random()*90000) + 10000;
        }
        deets.push(`${accessCode}`);
        // and we never have opts to add
        deets.push(null);

        // build the url
        let url = `${self.conn.urlBase}${api.createSession}`;

        // POST the reqeust
        request.post(url, {
          'auth': {
            'user': self.conn.auth.user,
            'pass': self.conn.auth.key,
            'sendImmediately': false
          },
          json: deets
        }, function(err, res, body){
          if (err){
            reject(err);
          } else if (res.statusCode != 200){
            reject(`Error: ${JSON.stringify(body)}`)
          } else {
            // gather the pertinent bits and return
            let sessionDeets = {
              sessionID: body,
              code: accessCode,
              name: name
            }
            resolve(sessionDeets);
          }
        })
      }
    } catch(err) {
      reject(err);
    }
  });
}



// ---EXPORT---
module.exports = new Queue();


// ---TIMERS---
// refresh before af token/cookie expires
setInterval(() => {

  // does our refresh timer expire in the next 2 minutes?
  if((module.exports.antiForgery.expire - 120000) < Date.now()){
    // mark the connection as not ready
    delete module.exports.conn.state;
    // flush the old af settings
    delete module.exports.antiForgery;
    delete module.exports.headers;
    // reconnect
    let deets = module.exports.conn;
    module.exports.connect(deets.urlBase, deets.auth.username, deets.auth.password)
      //.then(data => console.log(data))
      .catch(err => {throw new Error(err)})

  }
}, 60000)