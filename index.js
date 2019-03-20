 // index.js

// ---SETUP---
const request = require('request');

// api details
const api = {
  defaultGroup: "All Machines",
  testPath: "/openapidocument.axd",
  addEventToSessions: "/Services/PageService.ashx/event-to-sessions",
  guestSessionInfo: "/Services/PageService.ashx/guest-session-info"
}


// ---PUBLIC ITEMS---
// the object
function Queue() {
  // connection details
  this.conn = {};
}

// test initial connection to SC API and cache details
Queue.prototype.connect = function (urlBase, user, key) {
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
        self.conn.user = user;
      } else {
        reject("connect() expects user with call")
      }

      // save the key
      if (key){
        self.conn.key = key;
      } else {
        reject("connect() expects key with call")
      }

      // test connectivity to the api
      request.get(self.conn.apiUpTestPath, {
        'auth': {
          'user': self.conn.user,
          'pass': self.conn.key,
          'sendImmediately': false
        }
      }, function(err, res, body){
        if (err) {
          reject(err);
        } else {

          // did we get a valid response
          if (res.statusCode == 200){
            // convert the body
            body = JSON.parse(body);

            // note when we did this
            self.conn.lastConn = Date.now();

            // set connected to true
            self.conn.state = true;

            // resolve
            resolve(`${body.info.title}:${body.info.version}`);
          }
        }
      });

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
        request.post(url, {
          'auth': {
            'user': self.conn.user,
            'pass': self.conn.key,
            'sendImmediately': false
          },
          json: payload
        }, function(err, res, body){
          if (err){
            reject(err);
          } else if (res.statusCode != 200){
            reject(`Error: ${JSON.stringify(body)}`)
          } else {
            resolve({status: "success", message: body});
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
