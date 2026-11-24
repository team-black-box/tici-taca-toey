# Store listing

Everything the two store consoles ask for, written down once so the App
Store and Play listings say the same thing. Copy from here; when the
copy changes, change it here first.

Character limits are the stores' own and each field below fits its
limit. Re-check the limits in the console when pasting - they are the
stores' to change.

## Identity

| Field | Value |
| --- | --- |
| App name (both, 30) | `Tici Taca Toey` |
| Bundle id / package | `com.ticitacatoey` |
| Apple Team ID | `NZ2N94X98Y` |
| Primary category | Games > Board |
| Secondary (Apple) | Games > Strategy |
| Price | Free, no in-app purchases, no ads |
| Website / marketing URL | `https://ticitacatoey.com` |
| Privacy policy URL | `https://ticitacatoey.com/privacy.html` |
| Terms URL | `https://ticitacatoey.com/terms.html` |
| Support URL | `https://github.com/team-black-box/tici-taca-toey/issues` |

## Copy

**Subtitle (Apple, 30)**

```
Tic-tac-toe, any size, online
```

**Short description (Play, 80)**

```
Multiplayer tic-tac-toe: boards up to 12x12, up to 10 players, robots to beat.
```

**Promotional text (Apple, 170)**

```
Boards from 2x2 to 12x12, up to 10 players, the line length you choose, optional chess clocks. No account, no ads. Robots are standing by.
```

**Keywords (Apple, 100, comma separated, no spaces)**

```
tic tac toe,noughts,crosses,multiplayer,board,strategy,online,gomoku,robots,puzzle,daily,friends
```

**Description (both; Apple 4000, Play 4000)**

```
Tic-tac-toe, the way it should have shipped.

Three in a row on a three by three board is solved before you finish
your coffee. So change the rules. Play on any board from 2x2 to 12x12,
with up to 10 players, and decide how long a line has to be to win - or
how many lines it takes.

PLAY ANYONE
- Start a game and share the link. Whoever opens it takes a seat.
- Let strangers join, or keep it to people you invite.
- Play in teams, or every player for themselves.
- Add chess clocks when you want the pressure.
- Watch any live game as a spectator.

PLAY A ROBOT
Three resident robots are always online, from one that moves at random
to one that will not lose. One tap puts you in a game.

A PUZZLE A DAY
One position, one winning move, new every day.

A LADDER
Claim a handle and every game counts toward one rating, weighted by how
hard the game was. Every finished game can be replayed move by move.

NO ACCOUNT, NO ADS, NO TRACKING
The game never asks for your name, email or a password. There are no
ads, no analytics and no third-party trackers. The whole project is
open source.

Made with love in Bengaluru, India.
```

**What's new (first release)**

```
First release on the store. Hello!
```

## Review notes (Apple "App Review Information", Play "App access")

```
No sign-in is required and there is no account to create: the app is
fully usable on first launch. To see gameplay immediately, tap "PLAY A
ROBOT NOW" on the first screen - a resident robot joins and answers each
move. The app needs a network connection; it talks only to
wss://ticitacatoey.com.
```

Play "App access": *All functionality is available without special
access.*

## Age rating / content rating

Answer "none" to every content question (violence, sexual content,
profanity, gambling, drugs, horror). Two answers are not "none" and
should be given honestly:

- **Users can interact / user-generated content: yes.** Players choose a
  handle and a game name, and both are shown to other players. There is
  no chat. Apple asks whether such content can be reported or blocked;
  today the answer is that handles are capped, validated and can be
  reclaimed by the operator, and the contact for a report is the support
  URL above.
- **Unrestricted web access: no.** The only links out are privacy and
  terms.

Expected outcome: 4+ (Apple) / Everyone (Play, IARC).

## Privacy answers

**Read this before pasting "no data collected".** Both stores count
data as collected when it leaves the device and is kept, whether or not
it identifies a person. The server does keep two things a player
creates:

- the **handle** they choose, and
- their **game history** (moves, results, rating).

Neither is tied to a name, email, device id or advertising id, and
nothing is used for tracking or shared with anyone. The honest forms
are therefore:

*Apple - App Privacy*

- Data used to track you: **none**.
- Data collected: **Identifiers > User ID** (the handle) and **User
  Content > Gameplay Content**, each with purpose *App Functionality*,
  *not* used for tracking. Whether they are "linked to the user" is
  Apple's wording for "tied to an account": the handle and history are
  tied to the player's anonymous key, so the cautious answer is
  **linked**, and the listing will read "Data Linked to You: User ID,
  Gameplay Content".

*Play - Data safety*

- Collects data: **yes**. Shares data with third parties: **no**.
- **Personal info > User IDs** and **App activity > Other user-generated
  content** (or *App interactions*), collected, not shared, purpose *App
  functionality*, required.
- Encrypted in transit: **yes** (wss/https only).
- Deletion: a player can abandon the identity by deleting the app; there
  is no account to delete. Play asks for a deletion-request URL when an
  app "lets users create an account" - a handle is the nearest thing we
  have, so link the privacy policy section that explains this.

`ios/TiciTacaToey/PrivacyInfo.xcprivacy` currently declares an empty
`NSPrivacyCollectedDataTypes`. If the App Privacy answers above are the
ones submitted, the manifest should declare the same two types so the
two agree.

## Export compliance

Uses only the operating system's standard TLS (https/wss). `Info.plist`
sets `ITSAppUsesNonExemptEncryption` to `false`, so App Store Connect
does not ask on each upload. Play: no additional declaration.

## Other console declarations

- Ads: **no**. In-app purchases: **no**.
- Target audience (Play): 13 and over is the simplest honest answer;
  choosing an under-13 band pulls in the Families policy.
- Government / financial / health / news app: **no**.
- Advertising ID (Play): **not used**.

## Artwork

| Asset | Size | Status |
| --- | --- | --- |
| iOS app icon | 1024x1024, no alpha | in the asset catalog |
| iPhone screenshots, 6.9" | 1320x2868 | to capture (iPhone Pro Max simulator) |
| iPad screenshots, 13" | 2064x2752 | `screenshots/store/ipad-13/` (4) |
| Play icon | 512x512 PNG | to cut from `web/public/favicon.svg` |
| Play feature graphic | 1024x500 | to make |
| Play phone screenshots | long side at most 2x the short side | to capture |

The raw captures in `screenshots/` are device-native and are *not* store
sizes: the iPhone 17 Pro ones are 6.3", and the Pixel ones are taller
than Play's 2:1 limit.
