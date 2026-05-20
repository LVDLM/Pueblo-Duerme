# Security Specification for Werewolf Game

## 1. Data Invariants
- A player must belong to an active game.
- Only the moderator can change the critical game status and phase transitions.
- Players can only update their own 'vote' during the voting phase.
- Werewolves can only update the game's `werewolfTarget` during `werewolves_turn`.
- The Witch can only update `witchHeal` and `witchKill` during `witch_turn`.
- Cupid can only set `cupidCouples` during `cupid_turn`.
- Messages are filtered: non-werewolves cannot see werewolf-type messages.

## 2. The Dirty Dozen Payloads (Rejection Tests)
1. **Identity Spoofing**: User A trying to create a message with `senderId` of User B.
2. **State Shortcutting**: Updating `phase` to `day_vote` while in `lobby` without being moderator.
3. **Ghost Field**: Adding `isVerified: true` to a Player document.
4. **Action Breach**: Villager trying to update `nightTargets.werewolfTarget` during werewolf turn.
5. **Role Leak**: User A trying to read User B's `secret/data` before game ends.
6. **Chat Snooping**: Aldeano trying to list all messages including `werewolf` type.
7. **Dead Vote**: Player with `isAlive: false` trying to update their `vote`.
8. **Moderator Hijack**: Changing `moderatorId` of a game after creation.
9. **Timestamp Forging**: Sending a `createdAt` in the future for a message (we use `number` here, but ideally we'd use `serverTimestamp`).
10. **Cupid Overreach**: Cupid trying to link 3 players instead of 2.
11. **Witch double-heal**: Witch trying to heal twice (if we had a limit, but here she just sets a field).
12. **Zombie joins**: Trying to create a player in a game that has already started (`status != "waiting"`).

## 3. Conflict Report
| Collection | Identity Spoofing | State Shortcutting | Value Poisoning |
|------------|-------------------|-------------------|-----------------|
| games | Denied (moderatorId check) | Denied (isModerator Action check) | Denied (isValidGame) |
| players | Denied (isOwner(playerId)) | Denied (restricted fields) | Denied (isValidPlayer) |
| secrets | Denied (isOwner) | N/A | Denied (isValidSecret) |
| messages | Denied (senderId == auth.uid) | N/A | Denied (isValidMessage) |
