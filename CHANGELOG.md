# Changelog

## 3.2.2

- Realtime payloads given as a `SharedArrayBuffer` go as their bytes (not as JSON).
- README: Realtime.

## 3.2.1

- Realtime payloads in any byte form (`ArrayBuffer`, typed arrays, `DataView`) go as bytes; `read` says `more`.

## 3.2.0

- `realtime`: lists (`append`, `read`, `open`, `close`), channels (`publish`) and presence (`members`), with the server's rights.
