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
        reject("connect expects urlBase with call")
        //console.log("connect() expects urlBase with call");
        //return({status: false, message: "connect expects urlBase with call"});
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
        reject("connect expects user with call")
        //console.log("connect() expects user with call");
        //return({status: false, message: "connect() expects user with call"});
      }

      // save the key
      if (key){
        self.conn.key = key;
      } else {
        reject("connect expects key with call")
        //console.log("connect() expects key with call");
        //return({status: false, message: "connect() expects key with call"});
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
          //console.log(err);
          //return({status: false, message: err});
        } else {

          // did we get a valid response
          if (res.statusCode == 200){
            // convert the body
            body = JSON.parse(body);

            // note when we did this
            self.conn.lastConn = Date.now();

            // set connected to true
            self.conn.state = true;

            // return the api info title and version
            resolve(`${body.info.title}:${body.info.version}`);
            //return({status: true, message: `${body.info.title}:${body.info.version}`});

          }
        }
      });

    } catch(err) {
      reject(err);
      //console.log(err);
      //return({status: false, message: err});
    }
  });
}

// preflight check
Queue.prototype.preflightCheck = function (session, preflight) {
  return new Promise((resolve, reject)=>{

    // don't loose yourself
    const self = this;

    try{
      // bypass preflight?
      if (!preflight){
        resolve(true);
      }

      // build the url
      let url = `${self.conn.urlBase}${api.guestSessionInfo}`

      // do a lookup to see if the host is online
      request.get(url, {
        'auth': {
          'user': self.conn.user,
          'pass': self.conn.key,
          'sendImmediately': false
        },
        qs: {sessionIDs: session}
      }, function(err, res, body){
        if (err) {
          reject(err);
        } else {

          // t
          //console.log(res)

          // did we get a valid response?
          if (res.statusCode == 200){

            // clean up that body
            body = JSON.parse(body)

            // did we get a list back with exactly one session??
            if (body.hasOwnProperty("Sessions") && 2 > body.Sessions.length > 0 ){

              // verify that this is an access session
              let session = body.Sessions[0];
              if (session.hasOwnProperty("SessionType") && session.SessionType == 2){
                // check for an active connection from a guest system
                if(session.hasOwnProperty("ActiveConnections") && session.ActiveConnections.length > 0){
                  let guestIsActive = session.ActiveConnections.some(function(conn){
                    if(conn.ProcessType == 2){
                      return true;
                    }
                  });
                  // return findings
                  resolve(guestIsActive);
                } else {
                  // no active connections
                  resolve(false);
                }
              } else {
                reject({message: `preflightCheck() for sessionID: ${session} failed as this is a non-access session`})
              }
            } else {
              // something's up, reject it
              reject({message: `preflightCheck() for sessionID: ${session} returned ${body.Sessions.length} sessions.  There should only be 1`})
            }
          }
        }
      });
    } catch(err) {
      reject(err);
    }
  });
}

// Queue a command for a given host
Queue.prototype.command = function (session, command, opts = {preflight: true}) {
  return new Promise((resolve, reject)=>{

    // don't loose yourself
    const self = this;

    try{

      // ensure that the api connect is complete
      if (!self.conn.hasOwnProperty('state') || !self.conn.state){
        setTimeout(function(){
          //t
          console.log('tick');

          self.command(session, command, opts)
            .then(result => resolve(result));
        }, 500);
      } else {

        // review options
        // preflight checks that the host is connected before issuing commands
        if (!opts.hasOwnProperty('preflight') || typeof opts.preflight != "boolean"){
          // if we got something ugly or nothing for preflight then set it to true
          opts.preflight = true;
        }
        // default group to work With
        if (!opts.hasOwnProperty('group')){
          opts.group = api.defaultGroup;
        }

        // start with the preflight
        self.preflightCheck(session, opts.preflight)
          .then(preflight => {
            // build the url
            let url = `${self.conn.urlBase}${api.addEventToSessions}`;
            // build the payload
            let payload = [opts.group, [session], 44, command]

            // if preflight is good then queue the command
            if (preflight){
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
            } else {
              // return "command not queued"
              resolve({status: "failure", message: "Preflight failed.  Command not queued"});
            }

          })
          .catch(err => {
            reject(err);
          })
      }
    } catch(err) {
      reject(err);
    }
  });
}


// ---EXPORT---
module.exports = new Queue();
