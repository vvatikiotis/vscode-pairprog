# Dev Diary

## 11 Sept

Each client listens for changes in the master document and changes its content accordingly. This way I can check the extension's functionality by using 2 documents within the same VS Code instance.

## 12 Sept

- Moved all client logic to the `connect server` command. The Gulf master doc starts within the host extension process of the initiating peer.
- Need an additional http endpoint for session identification and management. I'll use Koa.
- Koa simple server is ready. Setup during extension activation and starts listening
when 'Start server' executes

## 15 Sept

- Spike using ShareDB. Better documented, more mature, more people than Gulf