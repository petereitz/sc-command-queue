# SC Command Queue

Queue command events Connectwise Control (Screen Connect) guest systems.

## Install

```
  npm install sc-command-queue
```

## Quick Start

```javascript
const queue = require('sc-command-queue');

// connect to the api
queue.connect("https://example.com", <username>, <password>)
  .then(status => console.log(status))
  .catch(err => console.log(err));

// send a command
queue.command(<session-id>, <command>, {group: <group>})
  .then(res => console.log(res))
  .catch(err => console.log(err));
```

## Usage

Once required, connect to a Screen Connect server using the `connect()` method.  From there, queue commands against the guest member of a given session with the `command()` method.

## Methods

- `connect(<api-location>, <user>, <password>)` - Takes the protocol and fqdn of your server (eg: `https://myServer.com`) as well as an authorized set of user credentials.  An attempt is made to connect `GET` `openapidocument.axd`.  If successful the app returns the ScreenConnect version number and `false` otherwise.  
- `command(<sessionID>, <command>, <options>)` - Queues a command for the guest system to execute. Waits for `connect()` to complete.
  - **sessionID** - Session ID of the guest system.
  - **command** - Escaped command string
  - **options**
    - **preflight** - `boolean`: verify that a guest is connected prior.  Defaults to `true`.
    - **group** -  `string`: the group that the guest belongs to.  Defaults to "All Machines".

## Changes
- **v1.1.0**
  - Removed `preflight()` as per-guest connect check can spike the processor for requests against large groups of systems.
    - Allow for SessionIDs to be passed as an array.

- **v1.0.1**
  - Add wait-for-connect logic to `command()`.

- **v1.0.0**
  - Initial


## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
