# Bookmark BLE Protocol — v1

The contract between the phone app (BLE **central**) and the Bookmark device
(BLE **peripheral**). Everything the firmware and the app's BLE layer do is
defined here; neither side should depend on behavior not written down in this
document. This protocol is hardware-agnostic — it works identically for the
dev-board prototype and a future custom PCB.

## Design principles

1. **The phone owns content.** Books live in the app. The device only ever
   holds the chunk of text it was most recently sent (typically a chapter).
2. **The device owns playback.** Position, play/pause state, speed, and theme
   are authoritative on the device, because the user's hands are on the
   device while reading. The app mirrors device state from notifications and
   never assumes a command took effect until the echoing STATE arrives.
3. **Sync is cheap.** The device pushes compact STATE notifications; the app
   persists position per-book so reading resumes anywhere.
4. **Survive disconnects.** The device keeps playing from RAM when the phone
   walks away. On reconnect the app reads STATE, compares `docId`, and either
   resumes or re-sends content.

## GATT layout

Device advertises as **`Bookmark`** with the primary service UUID below.

| Item  | UUID                                   | Properties          |
|-------|----------------------------------------|---------------------|
| Service | `b00c0000-feed-4c0d-a5e1-000000000001` | —                 |
| TEXT  | `b00c0000-feed-4c0d-a5e1-000000000002` | Write, Write-no-response |
| CTRL  | `b00c0000-feed-4c0d-a5e1-000000000003` | Write               |
| STATE | `b00c0000-feed-4c0d-a5e1-000000000004` | Read, Notify        |
| INFO  | `b00c0000-feed-4c0d-a5e1-000000000005` | Read                |

All multi-byte integers are **little-endian**. Text is **UTF-8**.

The app should request the maximum MTU immediately after connecting
(`gatt.requestMtu(247)` on Android) and size TEXT writes to `MTU - 3` bytes.

## INFO characteristic (read once after connect)

ASCII key=value pairs, `;`-separated. Example:

```
proto=1;fw=0.1.0;buf=98304
```

- `proto` — protocol version. The app must refuse to talk to a higher major
  version than it knows.
- `buf` — device text buffer capacity in bytes. The app must not send a
  document larger than this (split books into chapters/sections that fit).

## CTRL characteristic — commands (phone → device)

One command per write. First byte is the opcode.

| Opcode | Name       | Payload                          | Effect |
|--------|------------|----------------------------------|--------|
| `0x01` | PLAY       | —                                | Start/resume flashing |
| `0x02` | PAUSE      | —                                | Pause on current word |
| `0x03` | TOGGLE     | —                                | Toggle play/pause |
| `0x10` | SET_WPM    | `u16` words-per-minute           | Clamped to 60–1200 |
| `0x11` | SEEK       | `u32` word index                 | Jump to word (clamped) |
| `0x12` | THEME      | `u8` 0=dark 1=light              | Switch theme |
| `0x20` | BEGIN_DOC  | `u16` docId, `u32` byteLength    | Reset buffer, start receiving TEXT |
| `0x21` | END_DOC    | —                                | Finish upload, tokenize, ready to read |
| `0x30` | REQ_STATE  | —                                | Device sends a STATE notification |

Every command that changes state is answered with a STATE notification — that
notification is the acknowledgment. Unknown opcodes are ignored (forward
compatibility).

## TEXT characteristic — document transfer (phone → device)

Between BEGIN_DOC and END_DOC, the app writes the document's UTF-8 bytes as
sequential chunks. Chunks are raw bytes — no framing — because BLE preserves
write order per characteristic.

Flow control: use write-no-response for speed, but issue a **write-with-
response every 16 chunks** (and for the final chunk) so the device's buffer
can't be overrun. A ~50 KB chapter transfers in roughly 1–2 seconds at a
247-byte MTU.

Rules:
- Bytes written outside a BEGIN_DOC/END_DOC window are discarded.
- If the device runs out of buffer it keeps what fits; the app detects the
  mismatch because STATE after END_DOC reports fewer words than expected.
- `docId` is chosen by the app: a stable 16-bit hash of (bookId, chapter).
  It's how both sides recognize "the same document" across reconnects and
  reboots.
- Paragraph breaks: send `\n\n` between paragraphs — the device uses them for
  longer pauses. Any whitespace separates words.

## STATE characteristic — device status (device → phone)

14-byte packed struct, sent as a notification and readable on demand:

| Offset | Type  | Field       | Notes |
|--------|-------|-------------|-------|
| 0      | `u16` | docId       | 0 = no document |
| 2      | `u32` | wordIndex   | Word currently displayed |
| 6      | `u32` | totalWords  | 0 until END_DOC processed |
| 10     | `u16` | wpm         | Current speed |
| 12     | `u8`  | flags       | bit0 playing, bit1 light theme, bit2 doc loaded |
| 13     | `u8`  | battery     | 0–100 % |

Sent: on every state-changing command (the ack), on every device-side control
input (touch), once per second while playing, on reaching end of document
(with `playing=0`), and on REQ_STATE.

The app persists `(docId → wordIndex)` on every notification it receives.
That word index is the bookmark.

## Session flows

**Connect / resume.** Connect → request MTU → read INFO → read STATE.
- STATE `docId` matches the doc the user is reading and `doc loaded` is set:
  nothing to send — device kept it in RAM. Optionally SEEK if the app has a
  newer position (only if the app's position is *ahead*; the device wins ties).
- Otherwise: BEGIN_DOC → TEXT chunks → END_DOC. If the device's saved
  `docId` (persisted in flash) matches the incoming one, it restores the
  saved word index automatically — the STATE after END_DOC tells the app
  where the device resumed. Then PLAY when the user is ready.

**Disconnect mid-read.** Device keeps playing and keeps persisting position
locally. On reconnect the app reads STATE and adopts the device's position.

**End of chapter.** Device stops on the last word and notifies STATE with
`playing=0`, `wordIndex=totalWords-1`. The app responds by uploading the next
chapter (new `docId`) — giving seamless chapter-to-chapter reading while
connected.

**Conflict rule (the important one).** If both sides changed something while
disconnected, the *device* position and settings win. The app's saved
position is only a fallback for when the device lost its copy.

## Android quick reference (central side)

```kotlin
// after BluetoothGatt connect:
gatt.requestMtu(247)
// onMtuChanged → discoverServices()
// read INFO, subscribe to STATE (enable CCCD notifications), read STATE

fun sendDocument(gatt: BluetoothGatt, docId: Int, utf8: ByteArray) {
    ctrl.write(byteArrayOf(0x20) + u16le(docId) + u32le(utf8.size))
    utf8.asIterable().chunked(mtu - 3).forEachIndexed { i, chunk ->
        val needsAck = (i % 16 == 15) || isLast(i)
        text.write(chunk.toByteArray(),
            if (needsAck) WRITE_TYPE_DEFAULT else WRITE_TYPE_NO_RESPONSE)
    }
    ctrl.write(byteArrayOf(0x21))            // END_DOC
}
```

(On Android, serialize GATT operations — one outstanding write at a time,
advance from the operation callback. Libraries like Nordic's
`android-ble-library` or Kable handle this queueing for you and are worth
using.)

## Versioning

Additive changes (new opcodes, new INFO keys, STATE fields appended past
byte 13) don't bump `proto`. Breaking changes do, and the device would then
expose the new major version in INFO for the app to check.
